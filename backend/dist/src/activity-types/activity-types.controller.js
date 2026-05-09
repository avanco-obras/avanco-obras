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
exports.ActivityTypesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const activity_types_service_1 = require("./activity-types.service");
const create_activity_type_dto_1 = require("./dto/create-activity-type.dto");
const update_activity_type_dto_1 = require("./dto/update-activity-type.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ActivityTypesController = class ActivityTypesController {
    constructor(activityTypesService) {
        this.activityTypesService = activityTypesService;
    }
    findAll(projectId) {
        return this.activityTypesService.findAll(projectId);
    }
    create(projectId, dto) {
        return this.activityTypesService.create(projectId, dto);
    }
    update(id, dto) {
        return this.activityTypesService.update(id, dto);
    }
    remove(id) {
        return this.activityTypesService.remove(id);
    }
};
exports.ActivityTypesController = ActivityTypesController;
__decorate([
    (0, common_1.Get)('projects/:projectId/activity-types'),
    (0, swagger_1.ApiOperation)({ summary: 'List all activity types for a project' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Activity types returned successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Project not found' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ActivityTypesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/activity-types'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new activity type in a project' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Activity type created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Project not found' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Activity type name already exists in this project' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_activity_type_dto_1.CreateActivityTypeDto]),
    __metadata("design:returntype", void 0)
], ActivityTypesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('activity-types/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update an activity type' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Activity type updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Activity type not found' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Activity type name already exists in this project' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_activity_type_dto_1.UpdateActivityTypeDto]),
    __metadata("design:returntype", void 0)
], ActivityTypesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('activity-types/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Delete an activity type' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Activity type deleted successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Activity type not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ActivityTypesController.prototype, "remove", null);
exports.ActivityTypesController = ActivityTypesController = __decorate([
    (0, swagger_1.ApiTags)('activity-types'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [activity_types_service_1.ActivityTypesService])
], ActivityTypesController);
//# sourceMappingURL=activity-types.controller.js.map