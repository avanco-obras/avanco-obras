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
exports.UpdateRestrictionDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const create_restriction_dto_1 = require("./create-restriction.dto");
class UpdateRestrictionDto {
}
exports.UpdateRestrictionDto = UpdateRestrictionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Description of the restriction' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRestrictionDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Person responsible for resolving the restriction' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRestrictionDto.prototype, "responsible", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Due date for the restriction (ISO string)', example: '2025-06-01' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRestrictionDto.prototype, "dueDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: create_restriction_dto_1.RestrictionStatus, description: 'Restriction status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(create_restriction_dto_1.RestrictionStatus),
    __metadata("design:type", String)
], UpdateRestrictionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Timestamp when the restriction was resolved' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Date),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateRestrictionDto.prototype, "resolvedAt", void 0);
//# sourceMappingURL=update-restriction.dto.js.map