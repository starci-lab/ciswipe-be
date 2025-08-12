import { Injectable } from "@nestjs/common"
import * as ss from "simple-statistics"

// Interface representing a data point with x and y as numbers
export interface Point {
  x: number;  // Independent variable (e.g., numeric time or feature)
  y: number;  // Dependent variable (value to predict)
}

@Injectable()
export class RegressionService {
    // Method to compute linear regression from an array of points
    public computeRegression(points: Array<Point>) {
    // Check that the input array is not empty
        if (points.length < 10) {
            throw new Error("Input points array is too short")
        }
        // Perform linear regression using simple-statistics
        // linearRegression takes an array of [x, y] pairs and returns { m: slope, b: intercept }
        const samples = points.map(p => [p.x, p.y])
        const lr = ss.linearRegression(samples)
        const slope = lr.m      // Slope of the regression line
        const intercept = lr.b  // Y-intercept of the regression line
        const regressionLine = ss.linearRegressionLine(lr)
        const rSquared = ss.rSquared(samples, regressionLine)
        // Return the slope, intercept, and R-squared value
        return { slope, intercept, rSquared }
    }
}