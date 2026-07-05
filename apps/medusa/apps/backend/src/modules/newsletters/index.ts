import { Module } from "@medusajs/framework/utils"
import NewslettersModuleService from "./service"

export const NEWSLETTERS_MODULE = "newsletters"

export default Module(NEWSLETTERS_MODULE, {
  service: NewslettersModuleService,
})
