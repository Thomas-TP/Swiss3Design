import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { BetterAuthBridgeService } from "./service"

export default ModuleProvider(Modules.AUTH, {
  services: [BetterAuthBridgeService],
})
