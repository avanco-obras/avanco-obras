"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateScheduleItemDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateScheduleItemDto {
}
exports.CreateScheduleItemDto = CreateScheduleItemDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Parent schedule item ID (UUID)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateScheduleItemDto.prototype, "parentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Activity type ID (UUID)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateScheduleItemDto.prototype, "activityTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'WBS code (e.g. 1.1.2)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateScheduleItemDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Activity name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateScheduleItemDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Hierarchy level (0 = root)' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateScheduleItemDto.prototype, "level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Planned start date (ISO string)' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateScheduleItemDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Planned end date (ISO string)' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateScheduleItemDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Duration in working days' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateScheduleItemDto.prototype, "durationDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Planned progress percentage (0-100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateScheduleItemDto.prototype, "plannedProgress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Actual progress percentage (0-100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateScheduleItemDto.prototype, "actualProgress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Relative weight for progress calculation' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateScheduleItemDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Whether item is on the critical path' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateScheduleItemDto.prototype, "isCriticalPath", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Display order within siblings' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateScheduleItemDto.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Responsible person/team' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateScheduleItemDto.prototype, "responsible", void 0);
//# sourceMappingURL=create-schedule-item.dto.js.map