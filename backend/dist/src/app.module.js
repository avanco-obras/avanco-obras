"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const configuration_1 = require("./config/configuration");
const prisma_service_1 = require("./common/prisma.service");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const projects_module_1 = require("./projects/projects.module");
const towers_module_1 = require("./towers/towers.module");
const activity_types_module_1 = require("./activity-types/activity-types.module");
const schedule_module_1 = require("./schedule/schedule.module");
const measurements_module_1 = require("./measurements/measurements.module");
const weekly_planning_module_1 = require("./weekly-planning/weekly-planning.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const uploads_module_1 = require("./uploads/uploads.module");
const ai_import_module_1 = require("./ai-import/ai-import.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.default],
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60,
                    limit: 100,
                },
            ]),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            projects_module_1.ProjectsModule,
            towers_module_1.TowersModule,
            activity_types_module_1.ActivityTypesModule,
            schedule_module_1.ScheduleModule,
            measurements_module_1.MeasurementsModule,
            weekly_planning_module_1.WeeklyPlanningModule,
            dashboard_module_1.DashboardModule,
            uploads_module_1.UploadsModule,
            ai_import_module_1.AiImportModule,
        ],
        providers: [prisma_service_1.PrismaService],
        exports: [prisma_service_1.PrismaService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map