"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_controller_1 = require("./schedule.controller");
const schedule_service_1 = require("./schedule.service");
const baseline_controller_1 = require("./baseline.controller");
const baseline_service_1 = require("./baseline.service");
const physical_progress_controller_1 = require("./physical-progress.controller");
const physical_progress_service_1 = require("./physical-progress.service");
const prisma_service_1 = require("../common/prisma.service");
let ScheduleModule = class ScheduleModule {
};
exports.ScheduleModule = ScheduleModule;
exports.ScheduleModule = ScheduleModule = __decorate([
    (0, common_1.Module)({
        controllers: [schedule_controller_1.ScheduleController, baseline_controller_1.BaselineController, physical_progress_controller_1.PhysicalProgressController],
        providers: [schedule_service_1.ScheduleService, baseline_service_1.BaselineService, physical_progress_service_1.PhysicalProgressService, prisma_service_1.PrismaService],
        exports: [schedule_service_1.ScheduleService, baseline_service_1.BaselineService, physical_progress_service_1.PhysicalProgressService],
    })
], ScheduleModule);
//# sourceMappingURL=schedule.module.js.map