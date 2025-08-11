import { HttpService } from "@nestjs/axios"
import { Injectable, Logger } from "@nestjs/common"
import { firstValueFrom } from "rxjs"
import { envConfig } from "@/modules/env"
import axiosRetry from "axios-retry"

export interface FieldStat {
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  std?: number;
}

export interface StatPoint {
  date: string; // The date label for the aggregated data (format is flexible)
  count: number; // Number of raw points aggregated in this bucket
  context?: string; // Optional descriptive context or metadata
  fields: Record<string, FieldStat>; // Statistics per numeric field
}

export interface TimePoint {
  date: string; // The timestamp or date string of the raw data point
  [key: string]: unknown; // Additional dynamic fields representing metrics
}

interface AnalyzeSummaryParams {
  points: Array<TimePoint>;
  numericFields: Array<string>;
  context?: string;
  prompt?: string;
}

interface AnalyzeRawChunksParams {
  rawPoints: Array<TimePoint>;
  numericFields: Array<string>;
  chunkSize?: number;
  context?: string;
  promptForChunk?: string;
}

@Injectable()
export class DeepseekService {
    private readonly logger = new Logger(DeepseekService.name)
    private readonly apiKey: string
    private readonly apiUrl: string

    constructor(private readonly http: HttpService) {
        this.apiKey = envConfig().deepseek.apiKey
        this.apiUrl = envConfig().deepseek.apiUrl
        axiosRetry(this.http.axiosRef, {
            retries: 3,
            retryDelay: retryCount => retryCount * 1000,
            retryCondition: error => {
                return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                   (error.response?.status ?? 0) >= 500 // only retry if server or network error
            },
        })
    }

    private aggregate(
        points: Array<TimePoint>,
        numericFields: Array<string>,
        context?: string,
    ): Array<StatPoint> {
    // Group points by their date property
        const buckets: Record<string, Array<TimePoint>> = {}
        for (const p of points) {
            if (!buckets[p.date]) buckets[p.date] = []
            buckets[p.date].push(p)
        }

        // Helper function to calculate statistics for a numeric array
        const calcStats = (values: Array<number>): FieldStat => {
            if (!values.length) return {}
            const mean = values.reduce((a, b) => a + b, 0) / values.length
            const sorted = values.slice().sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            const median =
        sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
            const min = sorted[0]
            const max = sorted[sorted.length - 1]
            const variance =
        values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
            const std = Math.sqrt(variance)
            return { mean, median, min, max, std }
        }

        // Compute stats for each date bucket and each numeric field
        return Object.keys(buckets)
            .sort()
            .map((date) => {
                const arr = buckets[date]
                const fields: Record<string, FieldStat> = {}

                for (const field of numericFields) {
                    const values = arr
                        .map((r) =>
                            r[field] === undefined || r[field] === null
                                ? NaN
                                : Number(r[field]),
                        )
                        .filter((v) => Number.isFinite(v))

                    fields[field] = calcStats(values)
                }

                return {
                    date,
                    count: arr.length,
                    context,
                    fields,
                }
            })
    }

    public async analyzeSummary({
        points,
        numericFields,
        context,
        prompt,
    }: AnalyzeSummaryParams) {
        const summary = this.aggregate(points, numericFields, context)

        try {
            const payload = {
                type: "timeseries_summary",
                summary,
                prompt:
          prompt ??
          "Analyze these metrics: trends, volatility, risk signals, recommendations.",
            }
            const resp = await firstValueFrom(
                this.http.post(this.apiUrl, payload, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 30000,
                }),
            )
            return resp.data
        } catch (err) {
            this.logger.error("Deepseek analyzeSummary failed", err?.message || err)
            throw err
        }
    }

    public async analyzeRawChunks({
        rawPoints,
        numericFields,
        chunkSize = 1000,
        context,
        promptForChunk,
    }: AnalyzeRawChunksParams) {
        const chunks: Array<Array<TimePoint>> = []
        for (let i = 0; i < rawPoints.length; i += chunkSize) {
            chunks.push(rawPoints.slice(i, i + chunkSize))
        }

        const chunkResults: Array<unknown> = []
        for (let i = 0; i < chunks.length; i++) {
            const payload = {
                type: "timeseries_chunk",
                index: i,
                totalChunks: chunks.length,
                chunk: this.aggregate(chunks[i], numericFields, context),
                prompt:
          promptForChunk ?? "Summarize the chunk: patterns, spikes, anomalies.",
            }
            try {
                const resp = await firstValueFrom(
                    this.http.post(this.apiUrl, payload, {
                        headers: {
                            Authorization: `Bearer ${this.apiKey}`,
                            "Content-Type": "application/json",
                        },
                        timeout: 30000,
                    }),
                )
                chunkResults.push(resp.data)
            } catch (err) {
                this.logger.error(`Deepseek chunk ${i} failed: ${err?.message || err}`)
                chunkResults.push({ error: err?.message || "chunk failed" })
            }
        }

        try {
            const mergePayload = {
                type: "merge_summaries",
                summaries: chunkResults,
                prompt: "Merge into one analysis: trends, main risks, top actions.",
            }
            const merged = await firstValueFrom(
                this.http.post(this.apiUrl, mergePayload, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 30000,
                }),
            )
            return { merged: merged.data, chunks: chunkResults }
        } catch (err) {
            this.logger.warn(
                "Deepseek merge failed, returning chunk results only",
                err?.message || err,
            )
            return { chunks: chunkResults }
        }
    }
}