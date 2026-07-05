import { Module } from "@medusajs/framework/utils"
import MaterialsModuleService from "./service"

export const MATERIALS_MODULE = "materials"

export default Module(MATERIALS_MODULE, {
  service: MaterialsModuleService,
})
