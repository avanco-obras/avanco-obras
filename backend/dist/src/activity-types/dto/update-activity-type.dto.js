"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateActivityTypeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_activity_type_dto_1 = require("./create-activity-type.dto");
class UpdateActivityTypeDto extends (0, swagger_1.PartialType)(create_activity_type_dto_1.CreateActivityTypeDto) {
}
exports.UpdateActivityTypeDto = UpdateActivityTypeDto;
//# sourceMappingURL=update-activity-type.dto.js.map