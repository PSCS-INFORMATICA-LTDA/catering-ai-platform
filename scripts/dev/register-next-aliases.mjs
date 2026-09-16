import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./scripts/dev/next-alias-loader.mjs', pathToFileURL('./'))
