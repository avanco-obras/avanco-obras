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
exports.TowersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const towers_service_1 = require("./towers.service");
const create_tower_dto_1 = require("./dto/create-tower.dto");
const create_floor_dto_1 = require("./dto/create-floor.dto");
const create_unit_dto_1 = require("./dto/create-unit.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let TowersController = class TowersController {
    constructor(towersService) {
        this.towersService = towersService;
    }
    listTowers(projectId) {
        return this.towersService.listTowers(projectId);
    }
    createTower(projectId, dto) {
        return this.towersService.createTower(projectId, dto);
    }
    listFloors(_projectId, towerId) {
        return this.towersService.listFloors(towerId);
    }
    createFloor(_projectId, towerId, dto) {
        return this.towersService.createFloor(towerId, dto);
    }
    listUnits(floorId) {
        return this.towersService.listUnits(floorId);
    }
    createUnit(floorId, dto) {
        return this.towersService.createUnit(floorId, dto);
    }
};
exports.TowersController = TowersController;
__decorate([
    (0, common_1.Get)('projects/:projectId/towers'),
    (0, swagger_1.ApiOperation)({ summary: 'List all towers in a project' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Towers list returned successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Project not found' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TowersController.prototype, "listTowers", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/towers'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new tower in a project' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Tower created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Project not found' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_tower_dto_1.CreateTowerDto]),
    __metadata("design:returntype", void 0)
], TowersController.prototype, "createTower", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/towers/:towerId/floors'),
    (0, swagger_1.ApiOperation)({ summary: 'List all floors in a tower' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Floors list returned successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Tower not found' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('towerId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TowersController.prototype, "listFloors", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/towers/:towerId/floors'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new floor in a tower' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Floor created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Tower not found' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('towerId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_floor_dto_1.CreateFloorDto]),
    __metadata("design:returntype", void 0)
], TowersController.prototype, "createFloor", null);
__decorate([
    (0, common_1.Get)('floors/:floorId/units'),
    (0, swagger_1.ApiOperation)({ summary: 'List all units in a floor' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Units list returned successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Floor not found' }),
    __param(0, (0, common_1.Param)('floorId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TowersController.prototype, "listUnits", null);
__decorate([
    (0, common_1.Post)('floors/:floorId/units'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new unit in a floor' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Unit created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Floor not found' }),
    __param(0, (0, common_1.Param)('floorId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_unit_dto_1.CreateUnitDto]),
    __metadata("design:returntype", void 0)
], TowersController.prototype, "createUnit", null);
exports.TowersController = TowersController = __decorate([
    (0, swagger_1.ApiTags)('towers'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [towers_service_1.TowersService])
], TowersController);
//# sourceMappingURL=towers.controller.js.map