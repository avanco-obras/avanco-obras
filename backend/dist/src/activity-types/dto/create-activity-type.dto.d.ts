import { MeasurementMethod } from '@prisma/client';
export declare class CreateActivityTypeDto {
    name: string;
    measurementMethod?: MeasurementMethod;
    unit?: string;
    defaultQuantity?: number;
    weight?: number;
    order?: number;
}
