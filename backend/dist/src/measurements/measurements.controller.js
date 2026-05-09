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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeasurementsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const measurements_service_1 = require("./measurements.service");
const create_measurement_dto_1 = require("./dto/create-measurement.dto");
const batch_measurement_dto_1 = require("./dto/batch-measurement.dto");
let MeasurementsController = class MeasurementsController {
    constructor(measurementsService) {
        this.measurementsService = measurementsService;
    }
    findByUnit(unitId) {
        return this.measurementsService.findByUnit(unitId);
    }
    create(unitId, measuredById, dto) {
        return this.measurementsService.create(unitId, measuredById, dto);
    }
    update(id, dto) {
        return this.measurementsService.update(id, dto);
    }
    batchCreate(unitId, measuredById, dto) {
        return this.measurementsService.batchCreate(unitId, measuredById, dto);
    }
    getSummary(projectId) {
        return this.measurementsService.getSummary(projectId);
    }
    getBuildingData(projectId) {
        return this.measurementsService.getBuildingData(projectId);
    }
};
exports.MeasurementsController = MeasurementsController;
__decorate([
    (0, common_1.Get)('units/:unitId/measurements'),
    (0, swagger_1.ApiOperation)({ summary: 'List all measurements for a unit' }),
    (0, swagger_1.ApiParam)({ name: 'unitId', description: 'Unit ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns all measurements for the unit, including activityType' }),
    __param(0, (0, common_1.Param)('unitId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MeasurementsController.prototype, "findByUnit", null);
__decorate([
    (0, common_1.Post)('units/:unitId/measurements'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a measurement for a unit' }),
    (0, swagger_1.ApiParam)({ name: 'unitId', description: 'Unit ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Measurement created successfully' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('unitId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_measurement_dto_1.CreateMeasurementDto]),
    __metadata("design:returntype", void 0)
], MeasurementsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('measurements/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a measurement by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Measurement ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Measurement updated successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MeasurementsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('units/:unitId/measurements/batch'),
    (0, swagger_1.ApiOperation)({ summary: 'Batch create measurements for a unit' }),
    (0, swagger_1.ApiParam)({ name: 'unitId', description: 'Unit ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Measurements created in batch successfully' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('unitId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, batch_measurement_dto_1.BatchMeasurementDto]),
    __metadata("design:returntype", void 0)
], MeasurementsController.prototype, "batchCreate", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/measurements/summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Get measurements summary aggregated per floor for a project' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns average progress per floor across all towers' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MeasurementsController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/measurements/building-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Get building visualization data for a project' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns tower/floor/unit progress data for SVG building view' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MeasurementsController.prototype, "getBuildingData", null);
exports.MeasurementsController = MeasurementsController = __decorate([
    (0, swagger_1.ApiTags)('Measurements'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [measurements_service_1.MeasurementsService])
], MeasurementsController);
//# sourceMappingURL=measurements.controller.js.map