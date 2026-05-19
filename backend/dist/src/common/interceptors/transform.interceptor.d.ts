import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export interface ResponseWrapper<T> {
    data: T;
    statusCode: number;
    timestamp: string;
}
export declare class TransformInterceptor<T> implements NestInterceptor<T, ResponseWrapper<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseWrapper<T>>;
}
