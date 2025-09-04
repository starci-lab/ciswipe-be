import { Injectable } from "@nestjs/common"
import dayjs, { Dayjs } from "dayjs"

@Injectable()
export class DateService {
    public getDayjs(): Dayjs {
        return dayjs()
    }
}