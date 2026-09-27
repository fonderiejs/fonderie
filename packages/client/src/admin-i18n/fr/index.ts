import common from "./common";
import nav from "./nav";
import shell from "./shell";
import session from "./session";
import attention from "./attention";
import modules from "./modules";
import environment from "./environment";
import doctor from "./doctor";
import routes from "./routes";
import log from "./log";
import migrations from "./migrations";
import tokens from "./tokens";
import operators from "./operators";
import users from "./users";
import billing from "./billing";
import catalog from "./catalog";
import audit from "./audit";
import config from "./config";
import templates from "./templates";

// One object per domain; each non-English file is typed against its English
// counterpart, so a missing or extra key is a compile error.
const fr = { common, nav, shell, session, attention, modules, environment, doctor, routes, log, migrations, tokens, operators, users, billing, catalog, audit, config, templates };
export default fr;
