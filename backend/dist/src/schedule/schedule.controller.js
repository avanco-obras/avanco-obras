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
exports.ScheduleController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const schedule_service_1 = require("./schedule.service");
const create_schedule_item_dto_1 = require("./dto/create-schedule-item.dto");
const update_schedule_item_dto_1 = require("./dto/update-schedule-item.dto");
let ScheduleController = class ScheduleController {
    constructor(scheduleService) {
        this.scheduleService = scheduleService;
    }
    findAll(projectId) {
        return this.scheduleService.findAll(projectId);
    }
    create(projectId, dto) {
        return this.scheduleService.create(projectId, dto);
    }
    update(id, dto) {
        return this.scheduleService.update(id, dto);
    }
    remove(id) {
        return this.scheduleService.remove(id);
    }
    getGanttData(projectId) {
        return this.scheduleService.getGanttData(projectId);
    }
    getCurvaS(projectId) {
        return this.scheduleService.getCurvaS(projectId);
    }
};
exports.ScheduleController = ScheduleController;
__decorate([
    (0, common_1.Get)('projects/:id/schedule'),
    (0, swagger_1.ApiOperation)({ summary: 'List all schedule items for a project (flat list)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns all schedule items ordered by position' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ScheduleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('projects/:id/schedule'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a schedule item for a project' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Schedule item created successfully' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_schedule_item_dto_1.CreateScheduleItemDto]),
    __metadata("design:returntype", void 0)
], ScheduleController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('schedule/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a schedule item by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Schedule item ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Schedule item updated successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_schedule_item_dto_1.UpdateScheduleItemDto]),
    __metadata("design:returntype", void 0)
], ScheduleController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('schedule/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a schedule item and its children' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Schedule item ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Schedule item deleted' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ScheduleController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('projects/:id/schedule/gantt-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Gantt chart formatted data for a project' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns Gantt rows with hasChildren flag' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ScheduleController.prototype, "getGanttData", null);
__decorate([
    (0, common_1.Get)('projects/:id/schedule/curva-s'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Curva S (S-Curve) monthly data for a project' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns monthly cumulative planned vs actual progress' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ScheduleController.prototype, "getCurvaS", null);
exports.ScheduleController = ScheduleController = __decorate([
    (0, swagger_1.ApiTags)('Schedule'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [schedule_service_1.ScheduleService])
], ScheduleController);
//# sourceMappingURL=schedule.controller.js.map