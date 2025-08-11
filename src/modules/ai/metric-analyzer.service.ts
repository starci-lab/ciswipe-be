import { Injectable, Logger } from "@nestjs/common"
import { deepseek } from "@ai-sdk/deepseek"
import { generateText } from "ai"
import dayjs from "dayjs"
import ss from "simple-statistics"
import fs from "fs"

export interface FieldStat {
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  std?: number;
  count?: number;
  sum?: number;
  variance?: number;
}

export interface StatPoint {
  date: string; // The date label for the aggregated data
  count: number; // Number of raw points aggregated in this bucket
  context?: string; // Optional descriptive context
  fields: Record<string, FieldStat>; // Statistics per numeric field
}

export interface TimePoint {
  date: string; // The timestamp or date string
  fields: object; // Additional dynamic fields
}

interface AnalyzeSummaryParams {
  points: Array<TimePoint>;
  numericFields: Array<string>;
  context?: string;
  resultJsonFields: Array<
    Record<string, "number" | "json" | "boolean" | "string">
  >;
  prompt?: string;
  groupBy?: MetricAnalyzerGroupBy;
}

// interface AnalyzeRawChunksParams {
//   rawPoints: Array<TimePoint>;
//   numericFields: Array<string>;
//   chunkSize?: number;
//   context?: string;
//   promptForChunk?: string;
// }

export enum MetricAnalyzerGroupBy {
  Day = "day",
  Month = "month",
  Year = "year",
}

@Injectable()
export class MetricAnalyzerService {
    private readonly logger = new Logger(MetricAnalyzerService.name)
    constructor() {}

    private aggregate(
        points: Array<TimePoint>,
        numericFields: Array<string>,
        context?: string,
        groupBy: MetricAnalyzerGroupBy = MetricAnalyzerGroupBy.Day,
    ): Array<StatPoint> {
        const buckets: Record<string, Array<TimePoint>> = {}
        const getGroupKey = (dateStr: string): string => {
            const d = dayjs(dateStr)
            if (!d.isValid()) return dateStr // fallback
            switch (groupBy) {
            case MetricAnalyzerGroupBy.Year:
                return d.format("YYYY")
            case MetricAnalyzerGroupBy.Month:
                return d.format("YYYY-MM")
            case MetricAnalyzerGroupBy.Day:
            default:
                return d.format("YYYY-MM-DD")
            }
        }
        // Group by the computed key
        for (const p of points) {
            const key = getGroupKey(p.date)
            if (!buckets[key]) buckets[key] = []
            buckets[key].push(p)
        }
        // Math stats
        const calcStats = (values: Array<number>): FieldStat => {
            if (!values.length) return {}
            const count = values.length
            const sum = ss.sum(values)
            const mean = ss.mean(values)
            const median = ss.median(values)
            const min = ss.min(values)
            const max = ss.max(values)
            const variance = ss.variance(values)
            const std = ss.standardDeviation(values)
            return { count, sum, mean, median, min, max, variance, std }
        }
        return Object.keys(buckets)
            .sort()
            .map((date) => {
                const arr = buckets[date]
                const fields: Record<string, FieldStat> = {}
                for (const field of numericFields) {
                    const values = arr
                        .map((r) =>
                            r.fields[field] === undefined || r.fields[field] === null
                                ? NaN
                                : Number(r.fields[field]),
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

    public async analyzeSummary<TResult>({
        points,
        numericFields,
        context,
        prompt,
        resultJsonFields = [{ a: "string", b: "number" }],
        groupBy,
    }: AnalyzeSummaryParams): Promise<TResult> {
        const summary = this.aggregate(points, numericFields, context, groupBy)
        fs.writeFileSync(
            "summary.json",
            JSON.stringify(
                `
                ### Requirements
                    1. Identify key trends and patterns
                    2. Calculate volatility metrics
                    3. Highlight risk signals
                    4. Provide actionable recommendations

                ${prompt ? `### Task Description\n${prompt}` : ""}  
                ### Data Summary
                ${JSON.stringify(summary, null, 2)}
              
                ### Required Response Format
                Return a JSON object with exactly these fields:
                ${Object.entries(resultJsonFields[0])
        .map(([key, type]) => `- "${key}": "${type}"`)
        .join("\n  ")}
                `,
                null,
                2,
            ),
        )
        try {
            const { text } = await generateText({
                model: deepseek("deepseek-reasoner"),
                prompt: `
                ### Requirements
                    1. Identify key trends and patterns
                    2. Calculate volatility metrics
                    3. Highlight risk signals
                    4. Provide actionable recommendations

                ${prompt ? `### Task Description\n${prompt}` : ""}  
                ### Data Summary
                ${JSON.stringify(summary, null, 2)}
              
                ### Required Response Format
                STRICTLY RETURN VALID JSON ONLY - NO ADDITIONAL TEXT OR EXPLANATION:
                ${Object.entries(resultJsonFields[0])
        .map(([key, type]) => `- "${key}": "${type}"`)
        .join("\n  ")}
                REQUIREMENTS:
                1. Return ONLY valid JSON
                2. No additional commentary or formatting
                3. Round all numbers to 4 decimal places
                4. Include ALL specified fields
                5. Escape special characters in strings
                `,
                maxRetries: 3,
                temperature: 0.3,
                maxOutputTokens: 2000,
            })
            console.log(text)
            return JSON.parse(text) as TResult
        } catch (error) {
            this.logger.error("AI analysis failed", error)
            throw error
        }
    }

    // public async analyzeRawChunks({
    //     rawPoints,
    //     numericFields,
    //     chunkSize = 1000,
    //     context,
    //     promptForChunk,
    // }: AnalyzeRawChunksParams) {
    //     const chunks: Array<Array<TimePoint>> = []
    //     for (let i = 0; i < rawPoints.length; i += chunkSize) {
    //         chunks.push(rawPoints.slice(i, i + chunkSize))
    //     }

    //     const chunkResults: Array<unknown> = []
    //     for (let i = 0; i < chunks.length; i++) {
    //         try {
    //             const response = await this.deepSeek.analyzeTimeSeries({
    //                 type: "timeseries_chunk",
    //                 index: i,
    //                 totalChunks: chunks.length,
    //                 chunk: this.aggregate(chunks[i], numericFields, context),
    //                 prompt:
    //         promptForChunk ??
    //         "Summarize the chunk: patterns, spikes, anomalies.",
    //             })
    //             chunkResults.push(response)
    //         } catch (err) {
    //             this.logger.error(`DeepSeek chunk ${i} failed`, err)
    //             chunkResults.push({ error: err?.message || "chunk failed" })
    //         }
    //     }

    //     try {
    //         const mergedResponse = await this.deepSeek.mergeAnalyses({
    //             type: "merge_summaries",
    //             summaries: chunkResults,
    //             prompt: "Merge into one analysis: trends, main risks, top actions.",
    //         })
    //         return { merged: mergedResponse, chunks: chunkResults }
    //     } catch (err) {
    //         this.logger.warn(
    //             "DeepSeek merge failed, returning chunk results only",
    //             err,
    //         )
    //         return { chunks: chunkResults }
    //     }
    // }
}
