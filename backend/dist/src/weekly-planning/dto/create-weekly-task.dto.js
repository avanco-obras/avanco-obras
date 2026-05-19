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
exports.CreateWeeklyTaskDto = exports.TaskStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["COMPLETED"] = "COMPLETED";
    TaskStatus["NOT_COMPLETED"] = "NOT_COMPLETED";
    TaskStatus["PARTIALLY"] = "PARTIALLY";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
class CreateWeeklyTaskDto {
}
exports.CreateWeeklyTaskDto = CreateWeeklyTaskDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Task description' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWeeklyTaskDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Location / area where the task is executed' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWeeklyTaskDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'UUID of the user the task is assigned to' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateWeeklyTaskDto.prototype, "assignedToId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: TaskStatus, description: 'Task completion status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(TaskStatus),
    __metadata("design:type", String)
], CreateWeeklyTaskDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Reason for non-completion (when status is NOT_COMPLETED or PARTIALLY)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWeeklyTaskDto.prototype, "nonCompletionCause", void 0);
//# sourceMappingURL=create-weekly-task.dto.js.map