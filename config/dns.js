const dns = require('dns')

// Override the system DNS with reliable public resolvers.
// Fixes SRV-record lookups for mongodb+srv:// on Windows.
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1'])
