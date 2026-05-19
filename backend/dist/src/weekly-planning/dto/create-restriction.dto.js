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
exports.CreateRestrictionDto = exports.RestrictionStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var RestrictionStatus;
(function (RestrictionStatus) {
    RestrictionStatus["PENDING"] = "PENDING";
    RestrictionStatus["IN_ANALYSIS"] = "IN_ANALYSIS";
    RestrictionStatus["RELEASED"] = "RELEASED";
    RestrictionStatus["EXPIRED"] = "EXPIRED";
})(RestrictionStatus || (exports.RestrictionStatus = RestrictionStatus = {}));
class CreateRestrictionDto {
}
exports.CreateRestrictionDto = CreateRestrictionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Description of the restriction' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRestrictionDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Person responsible for resolving the restriction' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRestrictionDto.prototype, "responsible", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Due date for the restriction (ISO string)', example: '2025-06-01' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRestrictionDto.prototype, "dueDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: RestrictionStatus, description: 'Restriction status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(RestrictionStatus),
    __metadata("design:type", String)
], CreateRestrictionDto.prototype, "status", void 0);
//# sourceMappingURL=create-restriction.dto.js.map