"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyPlanningModule = void 0;
const common_1 = require("@nestjs/common");
const weekly_planning_controller_1 = require("./weekly-planning.controller");
const weekly_planning_service_1 = require("./weekly-planning.service");
const prisma_service_1 = require("../common/prisma.service");
let WeeklyPlanningModule = class WeeklyPlanningModule {
};
exports.WeeklyPlanningModule = WeeklyPlanningModule;
exports.WeeklyPlanningModule = WeeklyPlanningModule = __decorate([
    (0, common_1.Module)({
        controllers: [weekly_planning_controller_1.WeeklyPlanningController],
        providers: [weekly_planning_service_1.WeeklyPlanningService, prisma_service_1.PrismaService],
        exports: [weekly_planning_service_1.WeeklyPlanningService],
    })
], WeeklyPlanningModule);
//# sourceMappingURL=weekly-planning.module.js.map