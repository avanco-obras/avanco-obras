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
exports.WeeklyPlanningController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const weekly_planning_service_1 = require("./weekly-planning.service");
const create_weekly_plan_dto_1 = require("./dto/create-weekly-plan.dto");
const create_weekly_task_dto_1 = require("./dto/create-weekly-task.dto");
const update_weekly_task_dto_1 = require("./dto/update-weekly-task.dto");
const create_restriction_dto_1 = require("./dto/create-restriction.dto");
const update_restriction_dto_1 = require("./dto/update-restriction.dto");
let WeeklyPlanningController = class WeeklyPlanningController {
    constructor(weeklyPlanningService) {
        this.weeklyPlanningService = weeklyPlanningService;
    }
    findAll(projectId) {
        return this.weeklyPlanningService.findAll(projectId);
    }
    create(projectId, dto) {
        return this.weeklyPlanningService.create(projectId, dto);
    }
    findOne(id) {
        return this.weeklyPlanningService.findOne(id);
    }
    addTask(planId, dto) {
        return this.weeklyPlanningService.addTask(planId, dto);
    }
    updateTask(taskId, dto) {
        return this.weeklyPlanningService.updateTask(taskId, dto);
    }
    addRestriction(planId, dto) {
        return this.weeklyPlanningService.addRestriction(planId, dto);
    }
    updateRestriction(restrictionId, dto) {
        return this.weeklyPlanningService.updateRestriction(restrictionId, dto);
    }
    getPPCHistory(projectId) {
        return this.weeklyPlanningService.getPPCHistory(projectId);
    }
    generateFromSchedule(planId) {
        return this.weeklyPlanningService.generateFromSchedule(planId);
    }
};
exports.WeeklyPlanningController = WeeklyPlanningController;
__decorate([
    (0, common_1.Get)('projects/:projectId/weekly-plans'),
    (0, swagger_1.ApiOperation)({ summary: 'List all weekly plans for a project' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns all weekly plans ordered by year and week (newest first)' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/weekly-plans'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a weekly plan for a project' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Weekly plan created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'A plan already exists for this week/year in the project' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_weekly_plan_dto_1.CreateWeeklyPlanDto]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('weekly-plans/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a weekly plan by ID (includes tasks and restrictions)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Weekly Plan ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns the weekly plan with tasks and restrictions' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)('weekly-plans/:id/tasks'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a task to a weekly plan' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Weekly Plan ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Task added to the plan successfully' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_weekly_task_dto_1.CreateWeeklyTaskDto]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "addTask", null);
__decorate([
    (0, common_1.Patch)('weekly-tasks/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a weekly task by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Weekly Task ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Task updated successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_weekly_task_dto_1.UpdateWeeklyTaskDto]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "updateTask", null);
__decorate([
    (0, common_1.Post)('weekly-plans/:id/restrictions'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a restriction to a weekly plan' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Weekly Plan ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Restriction added to the plan successfully' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_restriction_dto_1.CreateRestrictionDto]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "addRestriction", null);
__decorate([
    (0, common_1.Patch)('restrictions/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a restriction by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Restriction ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Restriction updated successfully; resolvedAt is set automatically when status becomes RELEASED' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_restriction_dto_1.UpdateRestrictionDto]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "updateRestriction", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/weekly-plans/ppc-history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get last 12 weeks PPC history for a project' }),
    (0, swagger_1.ApiParam)({ name: 'projectId', description: 'Project ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns PPC actual (recalculated from tasks) and target per week' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "getPPCHistory", null);
__decorate([
    (0, common_1.Post)('weekly-plans/:id/generate'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate weekly tasks from overlapping schedule items' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Weekly Plan ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Tasks generated from schedule items that overlap the plan period' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WeeklyPlanningController.prototype, "generateFromSchedule", null);
exports.WeeklyPlanningController = WeeklyPlanningController = __decorate([
    (0, swagger_1.ApiTags)('Weekly Planning'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [weekly_planning_service_1.WeeklyPlanningService])
], WeeklyPlanningController);
//# sourceMappingURL=weekly-planning.controller.js.map