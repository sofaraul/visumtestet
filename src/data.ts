import reglerJson from '../data/regler.json'
import fragorJson from '../data/fragor.json'
import svarJson from '../data/svar.json'
import configJson from '../config.json'
import type { Config, Fraga, Regel, SvarInnehall } from './types'

export const regler = reglerJson as Regel[]
export const fragor = fragorJson.fragor as Fraga[]
export const innehall = svarJson as unknown as SvarInnehall
export const config = configJson as Config
