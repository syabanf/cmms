/// <reference path="./json.d.ts" />
import type { AppState } from './store'
import assetTypes from '../data/asset-types.json'
import assets from '../data/assets.json'
import bom from '../data/bom.json'
import calibrations from '../data/calibrations.json'
import company from '../data/company.json'
import costCenters from '../data/cost-centers.json'
import documents from '../data/documents.json'
import failureCodes from '../data/failure-codes.json'
import jobPlans from '../data/job-plans.json'
import locations from '../data/locations.json'
import meterReadings from '../data/meter-readings.json'
import meters from '../data/meters.json'
import parts from '../data/parts.json'
import people from '../data/people.json'
import pmSchedules from '../data/pm-schedules.json'
import rcas from '../data/rcas.json'
import requests from '../data/requests.json'
import safetyItems from '../data/safety-items.json'
import settings from '../data/settings.json'
import sites from '../data/sites.json'
import skills from '../data/skills.json'
import stockTxns from '../data/stock-txns.json'
import stock from '../data/stock.json'
import teams from '../data/teams.json'
import tools from '../data/tools.json'
import vendors from '../data/vendors.json'
import warehouses from '../data/warehouses.json'
import warrantyClaims from '../data/warranty-claims.json'
import workOrders from '../data/work-orders.json'

const seed = {
  company,
  sites,
  locations,
  costCenters,
  teams,
  skills,
  people,
  vendors,
  assetTypes,
  assets,
  meters,
  meterReadings,
  documents,
  bom,
  warrantyClaims,
  failureCodes,
  safetyItems,
  jobPlans,
  pmSchedules,
  requests,
  workOrders,
  warehouses,
  parts,
  stock,
  stockTxns,
  tools,
  calibrations,
  rcas,
  settings,
}

/** A fresh, deep copy of the generated seed data (see scripts/generate-fixtures.ts). */
export function seedState(): AppState {
  return structuredClone(seed) as AppState
}
