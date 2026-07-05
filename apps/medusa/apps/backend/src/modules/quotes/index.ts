import { Module } from "@medusajs/framework/utils"
import QuotesModuleService from "./service"

export const QUOTES_MODULE = "quotes"

export default Module(QUOTES_MODULE, {
  service: QuotesModuleService,
})
