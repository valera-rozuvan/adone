import PouchDB from "./setup";
import version from "./version";
import pouchDebug from "./../pouchdb-debug";
import pouchChangesFilter from "./../pouchdb-changes-filter";

// TODO: remove from pouchdb-core (breaking)
PouchDB.plugin(pouchDebug);

// TODO: remove from pouchdb-core (breaking)
PouchDB.plugin(pouchChangesFilter);

PouchDB.version = version;

export default PouchDB;
