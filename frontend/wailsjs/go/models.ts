export namespace main {
	
	export class AdvancedConfig {
	    connectTimeoutSeconds: number;
	    maxOpenConns: number;
	    maxIdleConns: number;
	
	    static createFrom(source: any = {}) {
	        return new AdvancedConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connectTimeoutSeconds = source["connectTimeoutSeconds"];
	        this.maxOpenConns = source["maxOpenConns"];
	        this.maxIdleConns = source["maxIdleConns"];
	    }
	}
	export class BulkInsertRequest {
	    profileId: string;
	    database: string;
	    table: string;
	    rows: any[];
	
	    static createFrom(source: any = {}) {
	        return new BulkInsertRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.database = source["database"];
	        this.table = source["table"];
	        this.rows = source["rows"];
	    }
	}
	export class ColumnInfo {
	    name: string;
	    type: string;
	    nullable: string;
	    key: string;
	    default: any;
	    extra: string;
	    comment: string;
	    ordinalPos: number;
	
	    static createFrom(source: any = {}) {
	        return new ColumnInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.nullable = source["nullable"];
	        this.key = source["key"];
	        this.default = source["default"];
	        this.extra = source["extra"];
	        this.comment = source["comment"];
	        this.ordinalPos = source["ordinalPos"];
	    }
	}
	export class TLSConfig {
	    mode: string;
	    serverName: string;
	    caCertPath: string;
	    clientCertPath: string;
	    clientKeyPath: string;
	
	    static createFrom(source: any = {}) {
	        return new TLSConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.serverName = source["serverName"];
	        this.caCertPath = source["caCertPath"];
	        this.clientCertPath = source["clientCertPath"];
	        this.clientKeyPath = source["clientKeyPath"];
	    }
	}
	export class SSHConfig {
	    enabled: boolean;
	    host: string;
	    port: string;
	    user: string;
	    password: string;
	    rememberPassword: boolean;
	    privateKey: string;
	    privateKeyPath: string;
	    passphrase: string;
	    rememberPassphrase: boolean;
	    knownHostKey: string;
	
	    static createFrom(source: any = {}) {
	        return new SSHConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.rememberPassword = source["rememberPassword"];
	        this.privateKey = source["privateKey"];
	        this.privateKeyPath = source["privateKeyPath"];
	        this.passphrase = source["passphrase"];
	        this.rememberPassphrase = source["rememberPassphrase"];
	        this.knownHostKey = source["knownHostKey"];
	    }
	}
	export class ConnectionConfig {
	    id: string;
	    name: string;
	    host: string;
	    port: string;
	    user: string;
	    password: string;
	    rememberPassword: boolean;
	    database: string;
	    ssh: SSHConfig;
	    tls: TLSConfig;
	    advanced: AdvancedConfig;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.rememberPassword = source["rememberPassword"];
	        this.database = source["database"];
	        this.ssh = this.convertValues(source["ssh"], SSHConfig);
	        this.tls = this.convertValues(source["tls"], TLSConfig);
	        this.advanced = this.convertValues(source["advanced"], AdvancedConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ConnectionStatus {
	    connected: boolean;
	    database: string;
	    server: string;
	    user: string;
	    viaSsh: boolean;
	    tls: string;
	    hostKey: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.database = source["database"];
	        this.server = source["server"];
	        this.user = source["user"];
	        this.viaSsh = source["viaSsh"];
	        this.tls = source["tls"];
	        this.hostKey = source["hostKey"];
	    }
	}
	export class DatabaseInfo {
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	    }
	}
	export class HostKeyPrompt {
	    required: boolean;
	    changed: boolean;
	    host: string;
	    fingerprint: string;
	    key: string;
	
	    static createFrom(source: any = {}) {
	        return new HostKeyPrompt(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.required = source["required"];
	        this.changed = source["changed"];
	        this.host = source["host"];
	        this.fingerprint = source["fingerprint"];
	        this.key = source["key"];
	    }
	}
	export class IndexInfo {
	    indexName: string;
	    columnName: string;
	    nonUnique: boolean;
	    seqInIndex: number;
	    indexType: string;
	    cardinality: any;
	    subPart: any;
	    nullable: string;
	
	    static createFrom(source: any = {}) {
	        return new IndexInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.indexName = source["indexName"];
	        this.columnName = source["columnName"];
	        this.nonUnique = source["nonUnique"];
	        this.seqInIndex = source["seqInIndex"];
	        this.indexType = source["indexType"];
	        this.cardinality = source["cardinality"];
	        this.subPart = source["subPart"];
	        this.nullable = source["nullable"];
	    }
	}
	export class QueryResult {
	    columns: string[];
	    rows: any[][];
	    rowsAffected: number;
	    elapsedMs: number;
	    message: string;
	    truncated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.rowsAffected = source["rowsAffected"];
	        this.elapsedMs = source["elapsedMs"];
	        this.message = source["message"];
	        this.truncated = source["truncated"];
	    }
	}
	export class RowMutation {
	    profileId: string;
	    database: string;
	    table: string;
	    keyValues: Record<string, any>;
	    values: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new RowMutation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.database = source["database"];
	        this.table = source["table"];
	        this.keyValues = source["keyValues"];
	        this.values = source["values"];
	    }
	}
	
	export class StoredCredentials {
	    mysqlPassword: string;
	    rememberMysqlPassword: boolean;
	    sshPassword: string;
	    rememberSshPassword: boolean;
	    sshPassphrase: string;
	    rememberSshPassphrase: boolean;
	
	    static createFrom(source: any = {}) {
	        return new StoredCredentials(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mysqlPassword = source["mysqlPassword"];
	        this.rememberMysqlPassword = source["rememberMysqlPassword"];
	        this.sshPassword = source["sshPassword"];
	        this.rememberSshPassword = source["rememberSshPassword"];
	        this.sshPassphrase = source["sshPassphrase"];
	        this.rememberSshPassphrase = source["rememberSshPassphrase"];
	    }
	}
	
	export class TableDataRequest {
	    profileId: string;
	    database: string;
	    table: string;
	    page: number;
	    pageSize: number;
	    where: string;
	    orderBy: string;
	    orderDir: string;
	
	    static createFrom(source: any = {}) {
	        return new TableDataRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.database = source["database"];
	        this.table = source["table"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	        this.where = source["where"];
	        this.orderBy = source["orderBy"];
	        this.orderDir = source["orderDir"];
	    }
	}
	export class TableDataResult {
	    columns: ColumnInfo[];
	    primaryKeys: string[];
	    rows: any[];
	    total: number;
	    page: number;
	    pageSize: number;
	
	    static createFrom(source: any = {}) {
	        return new TableDataResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], ColumnInfo);
	        this.primaryKeys = source["primaryKeys"];
	        this.rows = source["rows"];
	        this.total = source["total"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TableInfo {
	    name: string;
	    type: string;
	    rows: any;
	    engine: string;
	
	    static createFrom(source: any = {}) {
	        return new TableInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.rows = source["rows"];
	        this.engine = source["engine"];
	    }
	}

}

