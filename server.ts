import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { initialVehicles, initialDrivers, initialTrips, initialMaintenanceRecords, initialFuelExpenses } from './src/data/initialData';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'TransitOpsSuperSecretProductionEncryptionKey2026!#$*';

app.use(cors({ origin: true, credentials: true }));
app.use('/hubs/transitops', express.text({ type: '*/*' }));
app.use(express.json());

// Auto-Reverse Proxy to ASP.NET Core 10 Web API when running locally
const DOTNET_API_URL = process.env.DOTNET_API_URL || 'http://localhost:5000';
let isDotnetBackendActive = false;

async function checkDotnetBackend() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${DOTNET_API_URL}/swagger/v1/swagger.json`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      if (!isDotnetBackendActive) {
        console.log(`[TransitOps Bridge] ✅ Connected to active ASP.NET Core 10 Web API at ${DOTNET_API_URL}! Forwarding /api and /hubs traffic directly to C# backend.`);
      }
      isDotnetBackendActive = true;
      return;
    }
  } catch {
    // .NET backend not running
  }
  if (isDotnetBackendActive) {
    console.log('[TransitOps Bridge] ASP.NET Core backend went offline; switching back to local fallback handler.');
  }
  isDotnetBackendActive = false;
}

setInterval(checkDotnetBackend, 4000);
checkDotnetBackend();

// Transparent reverse proxy to .NET backend when active
app.use(async (req, res, next) => {
  if (!isDotnetBackendActive) return next();
  if (!req.path.startsWith('/api') && !req.path.startsWith('/hubs') && !req.path.startsWith('/swagger')) {
    return next();
  }

  try {
    const targetUrl = `${DOTNET_API_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (val && key.toLowerCase() !== 'host') {
        headers[key] = Array.isArray(val) ? val.join(',') : val;
      }
    }

    const options: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstreamRes = await fetch(targetUrl, options);
    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((value, name) => {
      if (name.toLowerCase() !== 'content-encoding' && name.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(name, value);
      }
    });

    const bodyBuffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(bodyBuffer));
  } catch (err) {
    console.warn(`[TransitOps Bridge] Error forwarding to ${req.originalUrl}:`, err);
    next();
  }
});

// In-Memory Multi-Tenant Store (with Supabase connection readiness)
interface TenantStore {
  vehicles: any[];
  drivers: any[];
  trips: any[];
  maintenance: any[];
  expenses: any[];
}

// Pre-seed demo tenant with rich Indian fleet data in INR (₹)
const stores: Record<string, TenantStore> = {
  demo_tenant: {
    vehicles: JSON.parse(JSON.stringify(initialVehicles)),
    drivers: JSON.parse(JSON.stringify(initialDrivers)),
    trips: JSON.parse(JSON.stringify(initialTrips)),
    maintenance: JSON.parse(JSON.stringify(initialMaintenanceRecords)),
    expenses: JSON.parse(JSON.stringify(initialFuelExpenses)),
  },
};

const users: Record<string, any> = {
  'manager@transitops.com': {
    id: 'usr-demo-1',
    fullName: 'Alex Morgan',
    email: 'manager@transitops.com',
    role: 'fleet_manager',
    tenantId: 'demo_tenant',
    isDemoAccount: true,
  },
  'driver@transitops.com': {
    id: 'usr-demo-2',
    fullName: 'Sarah Chen',
    email: 'driver@transitops.com',
    role: 'driver',
    tenantId: 'demo_tenant',
    isDemoAccount: true,
  },
  'safety@transitops.com': {
    id: 'usr-demo-3',
    fullName: 'Marcus Vance',
    email: 'safety@transitops.com',
    role: 'safety_officer',
    tenantId: 'demo_tenant',
    isDemoAccount: true,
  },
  'analyst@transitops.com': {
    id: 'usr-demo-4',
    fullName: 'David Miller',
    email: 'analyst@transitops.com',
    role: 'financial_analyst',
    tenantId: 'demo_tenant',
    isDemoAccount: true,
  },
};

const STORE_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(STORE_DIR, 'transitops_store.json');

function saveStoresToDisk() {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    const dataToSave = {
      stores,
      users,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[TransitOps Persistence] Could not save store to disk:', err);
  }
}

function loadStoresFromDisk() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.stores && typeof parsed.stores === 'object') {
        Object.assign(stores, parsed.stores);
      }
      if (parsed.users && typeof parsed.users === 'object') {
        Object.assign(users, parsed.users);
      }
      console.log('[TransitOps Persistence] Loaded existing tenant stores and accounts from disk.');
    }
  } catch (err) {
    console.warn('[TransitOps Persistence] Could not load store from disk:', err);
  }
}

// Initial load on server startup
loadStoresFromDisk();

function getTenantStore(tenantId: string): TenantStore {
  if (!stores[tenantId]) {
    // Newly created accounts start completely clean with 0 seeded items
    stores[tenantId] = {
      vehicles: [],
      drivers: [],
      trips: [],
      maintenance: [],
      expenses: [],
    };
    saveStoresToDisk();
  }
  return stores[tenantId];
}

// Authentication Middleware
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Fallback to demo tenant if unauthenticated for preview convenience
    (req as any).user = { tenantId: 'demo_tenant', role: 'fleet_manager', isDemoAccount: true };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch {
    (req as any).user = { tenantId: 'demo_tenant', role: 'fleet_manager', isDemoAccount: true };
    next();
  }
}

// Real-Time Event Clients (SSE for SignalR parity)
const eventClients = new Set<Response>();

// SignalR Client Registry & Keep-Alive
interface SignalRClient {
  id: string;
  res?: Response;
  handshakeComplete: boolean;
}
const signalrClients = new Map<string, SignalRClient>();

function broadcastRealtime(event: string, data: any) {
  // 1. Direct SSE event stream clients (/api/events)
  const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of eventClients) {
    try {
      client.write(sseMessage);
    } catch { }
  }

  // 2. SignalR Hub protocol clients (/hubs/transitops)
  let target = 'ReceiveNotification';
  let args: any[] = [data];
  if (event === 'trip_dispatched') {
    target = 'ReceiveTripDispatched';
    args = [data];
  } else if (event === 'trip_completed') {
    target = 'ReceiveTripCompleted';
    args = [data];
  } else if (event === 'vehicle_status') {
    target = 'ReceiveVehicleStatusChanged';
    args = [data.vehicleId, data.status];
  } else if (event === 'notification') {
    target = 'ReceiveNotification';
    args = [data];
  }

  // SignalR message delimiter is 0x1e (Record Separator)
  const signalrPayload = `data: ${JSON.stringify({ type: 1, target, arguments: args })}\x1e\n\n`;
  for (const [id, client] of signalrClients.entries()) {
    if (client.res) {
      try {
        client.res.write(signalrPayload);
      } catch {
        signalrClients.delete(id);
      }
    }
  }
}

// 0. SignalR Hub Protocol Handlers (/hubs/transitops)
app.all(['/hubs/transitops/negotiate', '/api/hubs/transitops/negotiate'], (req, res) => {
  const connectionId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  signalrClients.set(connectionId, { id: connectionId, handshakeComplete: false });
  res.setHeader('Content-Type', 'application/json');
  res.json({
    negotiateVersion: 1,
    connectionId,
    connectionToken: connectionId,
    availableTransports: [
      {
        transport: 'ServerSentEvents',
        transferFormats: ['Text'],
      },
      {
        transport: 'LongPolling',
        transferFormats: ['Text', 'Binary'],
      },
    ],
  });
});

app.get(['/hubs/transitops', '/api/hubs/transitops'], (req, res) => {
  const connectionId = (req.query.id as string) || (req.query.connectionToken as string) || `sig_${Date.now()}`;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  let client = signalrClients.get(connectionId);
  if (!client) {
    client = { id: connectionId, handshakeComplete: false };
    signalrClients.set(connectionId, client);
  }
  client.res = res;

  // SignalR Handshake Response
  res.write('data: {}\x1e\n\n');
  client.handshakeComplete = true;

  req.on('close', () => {
    if (client) {
      client.res = undefined;
    }
  });
});

app.post(['/hubs/transitops', '/api/hubs/transitops'], (req, res) => {
  const connectionId = (req.query.id as string) || (req.query.connectionToken as string);
  const client = connectionId ? signalrClients.get(connectionId) : undefined;
  if (client && client.res && !client.handshakeComplete) {
    client.res.write('data: {}\x1e\n\n');
    client.handshakeComplete = true;
  }
  res.status(200).send('OK');
});

app.delete(['/hubs/transitops', '/api/hubs/transitops'], (req, res) => {
  const connectionId = (req.query.id as string) || (req.query.connectionToken as string);
  if (connectionId) {
    signalrClients.delete(connectionId);
  }
  res.status(200).send('OK');
});

// Periodic SignalR Ping
setInterval(() => {
  const ping = `data: {"type":6}\x1e\n\n`;
  for (const [id, client] of signalrClients.entries()) {
    if (client.res) {
      try {
        client.res.write(ping);
      } catch {
        signalrClients.delete(id);
      }
    }
  }
}, 15000);

// ======================== API ROUTES ========================

// 1. Auth & Identity
app.post('/api/auth/login', (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  let user = users[email.toLowerCase()];
  const isDemo = email.toLowerCase().endsWith('@transitops.com');

  if (!user) {
    if (isDemo) {
      user = {
        id: `usr-${Date.now()}`,
        fullName: email.split('@')[0].replace('.', ' '),
        email,
        role: role || 'fleet_manager',
        tenantId: 'demo_tenant',
        isDemoAccount: true,
      };
      users[email.toLowerCase()] = user;
    } else {
      // Return error for non-existent registered users
      return res.status(401).json({ message: 'Account not found. Please register first.' });
    }
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      isDemoAccount: user.isDemoAccount,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    refreshToken: `ref_${Date.now()}`,
    user,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password, role } = req.body;
  if (!fullName || !email) {
    return res.status(400).json({ message: 'Full name and email are required' });
  }

  if (users[email.toLowerCase()]) {
    return res.status(400).json({ message: 'An account with this email already exists' });
  }

  // Create isolated tenant for newly registered user.
  // Seeded demo data is strictly hidden from new accounts!
  const newTenantId = `tenant_${Date.now()}`;
  const newUser = {
    id: `usr-${Date.now()}`,
    fullName,
    email: email.toLowerCase(),
    role: role || 'fleet_manager',
    tenantId: newTenantId,
    isDemoAccount: false,
  };

  users[email.toLowerCase()] = newUser;

  // Initialize clean empty store
  stores[newTenantId] = {
    vehicles: [],
    drivers: [],
    trips: [],
    maintenance: [],
    expenses: [],
  };
  saveStoresToDisk();

  const token = jwt.sign(
    {
      sub: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      tenantId: newUser.tenantId,
      isDemoAccount: false,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    refreshToken: `ref_${Date.now()}`,
    user: newUser,
  });
});

app.post('/api/workspace/sample-data', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  store.vehicles = JSON.parse(JSON.stringify(initialVehicles)).map((v: any) => ({ ...v, id: `veh-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }));
  store.drivers = JSON.parse(JSON.stringify(initialDrivers)).map((d: any) => ({ ...d, id: `drv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }));
  store.trips = JSON.parse(JSON.stringify(initialTrips)).map((t: any) => ({ ...t, id: `trip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }));
  store.maintenance = JSON.parse(JSON.stringify(initialMaintenanceRecords)).map((m: any) => ({ ...m, id: `maint-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }));
  store.expenses = JSON.parse(JSON.stringify(initialFuelExpenses)).map((e: any) => ({ ...e, id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }));
  saveStoresToDisk();
  broadcastRealtime('workspace_seeded', { tenantId });
  res.json({ message: 'Sample fleet data provisioned successfully into your workspace.' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const email = (req as any).user?.email;
  const user = users[email?.toLowerCase()] || (req as any).user;
  res.json(user);
});

// 2. Vehicles
app.get('/api/vehicles', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { status, region, search } = req.query;

  let list = [...store.vehicles];

  if (status && status !== 'All') {
    list = list.filter((v) => v.status === status);
  }
  if (region && region !== 'All') {
    list = list.filter((v) => v.region === region);
  }
  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    list = list.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        v.registrationNumber.toLowerCase().includes(s) ||
        v.model.toLowerCase().includes(s)
    );
  }

  res.json(list);
});

app.post('/api/vehicles', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { registrationNumber, name, model, type, maxCapacityKg, currentOdometerKm, acquisitionCost, region } = req.body;

  if (!registrationNumber || !name || !maxCapacityKg) {
    return res.status(400).json({ message: 'Missing required vehicle fields' });
  }

  const exists = store.vehicles.some(
    (v) => v.registrationNumber.toUpperCase() === registrationNumber.trim().toUpperCase()
  );
  if (exists) {
    return res.status(400).json({ message: `Vehicle with plate '${registrationNumber}' already registered.` });
  }

  const newVehicle = {
    id: `veh-${Date.now()}`,
    registrationNumber: registrationNumber.trim().toUpperCase(),
    name,
    model: model || 'Commercial Freight Carrier',
    type: type || 'Truck',
    maxCapacityKg: Number(maxCapacityKg),
    currentOdometerKm: Number(currentOdometerKm || 0),
    acquisitionCost: Number(acquisitionCost || 0),
    status: 'Available',
    region: region || 'Mumbai West Hub',
    revenueGenerated: 0,
    fuelEfficiencyKmPerLiter: type === 'Van' ? 12.0 : 4.0,
    documents: [
      { type: 'Commercial Insurance', expiryDate: '2027-04-10', status: 'Valid' },
      { type: 'Fitness Certificate', expiryDate: '2027-05-15', status: 'Valid' },
    ],
    createdAt: new Date().toISOString(),
  };

  store.vehicles.unshift(newVehicle);
  saveStoresToDisk();
  broadcastRealtime('vehicle_created', { ...newVehicle, tenantId });
  res.status(201).json(newVehicle);
});

app.put('/api/vehicles/:id/status', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { id } = req.params;
  const { status } = req.body;

  const vehicle = store.vehicles.find((v) => v.id === id);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

  vehicle.status = status;
  saveStoresToDisk();
  broadcastRealtime('vehicle_status', { vehicleId: id, status, tenantId });
  res.json(vehicle);
});

app.delete('/api/vehicles/:id', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { id } = req.params;

  const vehicle = store.vehicles.find((v) => v.id === id);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

  vehicle.status = 'Retired';
  saveStoresToDisk();
  broadcastRealtime('vehicle_status', { vehicleId: id, status: 'Retired', tenantId });
  res.json({ message: 'Vehicle retired successfully' });
});

// 3. Drivers
app.get('/api/drivers', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { status, search } = req.query;

  let list = [...store.drivers];

  if (status && status !== 'All') {
    list = list.filter((d) => d.status === status);
  }
  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    list = list.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.licenseNumber.toLowerCase().includes(s) ||
        d.email.toLowerCase().includes(s)
    );
  }

  res.json(list);
});

app.post('/api/drivers', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { name, email, contactNumber, licenseNumber, licenseCategory, licenseExpiryDate } = req.body;

  if (!name || !licenseNumber || !email) {
    return res.status(400).json({ message: 'Missing required driver fields' });
  }

  const exists = store.drivers.some(
    (d) => d.licenseNumber.toUpperCase() === licenseNumber.trim().toUpperCase() || d.email === email
  );
  if (exists) {
    return res.status(400).json({ message: 'Driver with this license or email already exists' });
  }

  const newDriver = {
    id: `drv-${Date.now()}`,
    name,
    email,
    contactNumber: contactNumber || '+91 98000 00000',
    licenseNumber: licenseNumber.trim().toUpperCase(),
    licenseCategory: licenseCategory || 'Heavy Commercial Vehicle (HCV)',
    licenseExpiryDate: licenseExpiryDate || '2028-01-01',
    safetyScore: 100,
    status: 'Available',
    tripsCount: 0,
    totalTripsCompleted: 0,
    incidentHistoryCount: 0,
    createdAt: new Date().toISOString(),
  };

  store.drivers.unshift(newDriver);
  saveStoresToDisk();
  broadcastRealtime('driver_created', { ...newDriver, tenantId });
  res.status(201).json(newDriver);
});

app.put('/api/drivers/:id/toggle-suspension', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const driver = store.drivers.find((d) => d.id === req.params.id);
  if (!driver) return res.status(404).json({ message: 'Driver not found' });

  driver.status = driver.status === 'Suspended' ? 'Available' : 'Suspended';
  saveStoresToDisk();
  broadcastRealtime('driver_status', { driverId: driver.id, status: driver.status, tenantId });
  res.json(driver);
});

app.post('/api/drivers/:id/send-license-reminder', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const driver = store.drivers.find((d) => d.id === req.params.id);
  if (!driver) return res.status(404).json({ message: 'Driver not found' });

  res.json({ message: `Compliance notice transmitted to ${driver.email}` });
});

// 4. Trips
app.get('/api/trips', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { status, search } = req.query;

  let list = [...store.trips];
  if (status && status !== 'All') {
    list = list.filter((t) => t.status === status);
  }
  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    list = list.filter(
      (t) =>
        t.tripCode.toLowerCase().includes(s) ||
        t.source.toLowerCase().includes(s) ||
        t.destination.toLowerCase().includes(s)
    );
  }

  res.json(list);
});

app.post('/api/trips', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { source, destination, vehicleId, driverId, cargoWeightKg, plannedDistanceKm, revenue } = req.body;

  const vehicle = store.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return res.status(400).json({ message: 'Assigned vehicle not found' });

  const driver = store.drivers.find((d) => d.id === driverId);
  if (!driver) return res.status(400).json({ message: 'Assigned driver not found' });

  // Rule 1: Never Overload Cargo
  if (Number(cargoWeightKg) > vehicle.maxCapacityKg) {
    return res.status(400).json({
      message: `Cargo payload (${Number(cargoWeightKg).toLocaleString()} kg) exceeds vehicle max capacity (${vehicle.maxCapacityKg.toLocaleString()} kg).`,
    });
  }

  // Rule 2: Ground Expired or Suspended Drivers
  const isExpired = new Date(driver.licenseExpiryDate) < new Date();
  if (driver.status === 'Suspended' || isExpired) {
    return res.status(422).json({
      message: 'Driver cannot be dispatched due to expired commercial license or active safety suspension.',
    });
  }

  const tripCode = `TR-${Math.floor(100 + Math.random() * 900)}`;
  const tripRevenue = Number(revenue) || Math.round(Number(plannedDistanceKm) * 45); // ₹45/km

  const newTrip = {
    id: `trip-${Date.now()}`,
    tripCode,
    source,
    destination,
    vehicleId: vehicle.id,
    vehicleRegNumber: vehicle.registrationNumber,
    vehicleName: vehicle.name,
    driverId: driver.id,
    driverName: driver.name,
    cargoWeightKg: Number(cargoWeightKg),
    plannedDistanceKm: Number(plannedDistanceKm),
    revenue: tripRevenue,
    status: 'Draft',
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };

  store.trips.unshift(newTrip);
  saveStoresToDisk();
  broadcastRealtime('trip_created', { ...newTrip, tenantId });
  res.status(201).json(newTrip);
});

// Atomic Dispatch
app.post('/api/trips/:id/dispatch', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const trip = store.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const vehicle = store.vehicles.find((v) => v.id === trip.vehicleId);
  const driver = store.drivers.find((d) => d.id === trip.driverId);

  if (vehicle) vehicle.status = 'On Trip';
  if (driver) driver.status = 'On Trip';
  trip.status = 'Dispatched';
  trip.dispatchedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  saveStoresToDisk();
  broadcastRealtime('trip_dispatched', { tripId: trip.id, vehicleId: trip.vehicleId, driverId: trip.driverId, tenantId });
  res.json(trip);
});

// Atomic Complete
app.post('/api/trips/:id/complete', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { finalOdometerKm, fuelConsumedLiters } = req.body;

  const trip = store.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const vehicle = store.vehicles.find((v) => v.id === trip.vehicleId);
  const driver = store.drivers.find((d) => d.id === trip.driverId);

  const finalKm = Number(finalOdometerKm);
  const fuelL = Number(fuelConsumedLiters || 0);

  trip.status = 'Completed';
  trip.finalOdometerKm = finalKm;
  trip.fuelConsumedLiters = fuelL;
  trip.completedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  if (vehicle) {
    vehicle.status = 'Available';
    vehicle.currentOdometerKm = finalKm;
    vehicle.revenueGenerated += trip.revenue;

    // Auto-record fuel expense in INR (₹)
    if (fuelL > 0) {
      const fuelCost = Math.round(fuelL * 105); // ₹105/L average Indian diesel
      store.expenses.unshift({
        id: `exp-${Date.now()}`,
        vehicleId: vehicle.id,
        vehicleRegNumber: vehicle.registrationNumber,
        vehicleName: vehicle.name,
        type: 'Fuel',
        liters: fuelL,
        cost: fuelCost,
        amount: fuelCost,
        date: new Date().toISOString().split('T')[0],
        odometerReading: finalKm,
        notes: `Turn-in diesel refill for ${trip.tripCode}`,
      });
    }
  }

  if (driver) {
    driver.status = 'Available';
    driver.tripsCount = (driver.tripsCount || 0) + 1;
    driver.totalTripsCompleted = (driver.totalTripsCompleted || 0) + 1;
  }

  saveStoresToDisk();
  broadcastRealtime('trip_completed', { tripId: trip.id, finalOdometerKm: finalKm, tenantId });
  res.json(trip);
});

// 5. Maintenance
app.get('/api/maintenance', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  res.json(store.maintenance);
});

app.post('/api/maintenance', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { vehicleId, serviceType, description, cost, technicianNotes } = req.body;

  const vehicle = store.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return res.status(400).json({ message: 'Vehicle not found' });

  const record = {
    id: `maint-${Date.now()}`,
    vehicleId: vehicle.id,
    vehicleRegNumber: vehicle.registrationNumber,
    vehicleName: vehicle.name,
    serviceType: serviceType || 'Scheduled PM',
    description: description || 'Scheduled inspection',
    cost: Number(cost || 0),
    date: new Date().toISOString().split('T')[0],
    status: 'Active',
    technicianNotes: technicianNotes || 'In repair bay.',
  };

  vehicle.status = 'In Shop';
  store.maintenance.unshift(record);

  // Also log into expenses
  store.expenses.unshift({
    id: `exp-${Date.now()}`,
    vehicleId: vehicle.id,
    vehicleRegNumber: vehicle.registrationNumber,
    vehicleName: vehicle.name,
    type: 'Maintenance',
    cost: Number(cost || 0),
    amount: Number(cost || 0),
    date: new Date().toISOString().split('T')[0],
    notes: `${serviceType} - ${description}`,
  });

  saveStoresToDisk();
  broadcastRealtime('maintenance_created', { ...record, tenantId });
  res.status(201).json(record);
});

app.post('/api/maintenance/:id/close', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { finalCost, notes } = req.body;

  const record = store.maintenance.find((m) => m.id === req.params.id);
  if (!record) return res.status(404).json({ message: 'Record not found' });

  record.status = 'Completed';
  if (finalCost !== undefined) record.cost = Number(finalCost);
  if (notes) record.technicianNotes = notes;
  record.completedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const vehicle = store.vehicles.find((v) => v.id === record.vehicleId);
  if (vehicle) vehicle.status = 'Available';

  saveStoresToDisk();
  broadcastRealtime('maintenance_closed', { id: record.id, tenantId });
  res.json(record);
});

// 6. Expenses
app.get('/api/expenses', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  res.json(store.expenses);
});

app.post('/api/expenses', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const { vehicleId, type, category, cost, amount, liters, odometerReading, notes } = req.body;

  const vehicle = store.vehicles.find((v) => v.id === vehicleId);
  const expenseAmount = Number(cost || amount || 0);

  const newExpense = {
    id: `exp-${Date.now()}`,
    vehicleId: vehicleId || '',
    vehicleRegNumber: vehicle?.registrationNumber || 'Fleet',
    vehicleName: vehicle?.name || 'Asset',
    type: type || category || 'Other',
    category: type || category || 'Other',
    cost: expenseAmount,
    amount: expenseAmount,
    liters: liters ? Number(liters) : undefined,
    odometerReading: odometerReading ? Number(odometerReading) : undefined,
    date: new Date().toISOString().split('T')[0],
    notes: notes || '',
  };

  store.expenses.unshift(newExpense);
  saveStoresToDisk();
  broadcastRealtime('expense_created', { ...newExpense, tenantId });
  res.status(201).json(newExpense);
});

app.delete('/api/expenses/:id', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  store.expenses = store.expenses.filter((e) => e.id !== req.params.id);
  saveStoresToDisk();
  res.json({ message: 'Expense deleted' });
});

// 7. Role-Specific KPIs (Computed directly in INR ₹)
app.get('/api/kpi/fleet', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);

  const totalVehicles = store.vehicles.filter((v) => v.status !== 'Retired').length;
  const activeDispatches = store.trips.filter((t) => t.status === 'Dispatched').length;
  const availableAssets = store.vehicles.filter((v) => v.status === 'Available').length;
  const maintenanceHolds = store.vehicles.filter((v) => v.status === 'In Shop').length;
  const pendingDepartures = store.trips.filter((t) => t.status === 'Draft').length;

  const fleetUtilizationRate = totalVehicles > 0 ? Math.round((activeDispatches / totalVehicles) * 100) : 0;

  res.json({
    totalVehicles,
    activeDispatches,
    availableAssets,
    maintenanceHolds,
    fleetUtilizationRate,
    totalTripsInProgress: activeDispatches,
    pendingDepartures,
  });
});

app.get('/api/kpi/financial', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);

  const maintenanceSpend = store.maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
  const fuelSpend = store.expenses
    .filter((e) => (e.type || e.category) === 'Fuel')
    .reduce((sum, e) => sum + (e.cost || e.amount || 0), 0);
  const otherExpenses = store.expenses
    .filter((e) => (e.type || e.category) !== 'Fuel' && (e.type || e.category) !== 'Maintenance')
    .reduce((sum, e) => sum + (e.cost || e.amount || 0), 0);

  const completedTrips = store.trips.filter((t) => t.status === 'Completed');
  const grossRevenue = completedTrips.reduce((sum, t) => sum + (t.revenue || 0), 0);
  const totalKm = completedTrips.reduce((sum, t) => sum + (t.plannedDistanceKm || 0), 0);

  const totalOpex = maintenanceSpend + fuelSpend + otherExpenses;
  const netProfit = grossRevenue - totalOpex;
  const netMarginPercentage = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100 * 10) / 10 : 0;
  const costPerKm = totalKm > 0 ? Math.round((totalOpex / totalKm) * 10) / 10 : 0;

  res.json({
    totalOpex,
    fuelSpend,
    maintenanceSpend,
    grossRevenue,
    netProfit,
    netMarginPercentage,
    costPerKm,
    currency: 'INR',
  });
});

app.get('/api/kpi/safety', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const now = new Date();
  const warningDate = new Date();
  warningDate.setDate(now.getDate() + 30);

  let expired = 0;
  let expiringSoon = 0;
  let suspended = 0;
  let compliant = 0;
  let totalScore = 0;

  for (const driver of store.drivers) {
    const exp = new Date(driver.licenseExpiryDate);
    if (driver.status === 'Suspended') suspended++;
    if (exp < now) {
      expired++;
    } else if (exp <= warningDate) {
      expiringSoon++;
    } else if (driver.status !== 'Suspended') {
      compliant++;
    }
    totalScore += driver.safetyScore || 100;
  }

  const averageSafetyScore = store.drivers.length > 0 ? Math.round(totalScore / store.drivers.length) : 100;
  const inShopLocks = store.vehicles.filter((v) => v.status === 'In Shop').length;

  res.json({
    expiredLicenses: expired,
    expiringSoon,
    suspendedDrivers: suspended,
    compliantDrivers: compliant,
    inShopInspectionLocks: inShopLocks,
    averageSafetyScore,
  });
});

// 8. Documentation & Postman Exports
app.get('/api/docs/postman', (req, res) => {
  const filePath = path.resolve(process.cwd(), 'postman_collection.json');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="TransitOps.postman_collection.json"');
    return fs.createReadStream(filePath).pipe(res);
  }
  res.status(404).json({ message: 'Postman collection not found' });
});

app.get('/api/docs/swagger.json', (req, res) => {
  res.json({
    openapi: '3.0.1',
    info: {
      title: 'TransitOps Enterprise API',
      version: 'v1.0.0',
      description: 'ASP.NET Core 10 Web API and Node.js Full-Stack Services for TransitOps.',
    },
    paths: {
      '/api/auth/login': { post: { summary: 'User login & JWT acquisition' } },
      '/api/auth/register': { post: { summary: 'New tenant user registration' } },
      '/api/vehicles': { get: { summary: 'List vehicles' }, post: { summary: 'Register vehicle' } },
      '/api/drivers': { get: { summary: 'List drivers' }, post: { summary: 'Register driver' } },
      '/api/trips': { get: { summary: 'List trips' }, post: { summary: 'Create dispatch' } },
      '/api/trips/{id}/dispatch': { post: { summary: 'Atomic trip dispatch' } },
      '/api/trips/{id}/complete': { post: { summary: 'Atomic delivery completion' } },
      '/api/kpi/fleet': { get: { summary: 'Fleet Manager KPIs' } },
      '/api/kpi/financial': { get: { summary: 'Financial Analyst KPIs (INR ₹)' } },
      '/api/export/trips/csv': { get: { summary: 'Export trips performance report to CSV' } },
      '/api/export/roi/csv': { get: { summary: 'Export vehicle ROI matrix to CSV' } },
    },
  });
});

// CSV Export Endpoints
app.get('/api/export/trips/csv', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const rows = [
    ['Trip Code', 'Source', 'Destination', 'Vehicle', 'Driver', 'Planned Distance (km)', 'Cargo Weight (kg)', 'Status', 'Gross Revenue (INR)']
  ];
  for (const t of store.trips) {
    rows.push([
      t.tripCode,
      t.source,
      t.destination,
      t.vehicleName || '',
      t.driverName || '',
      String(t.plannedDistanceKm || 0),
      String(t.cargoWeightKg || 0),
      t.status,
      String(t.revenue || 0)
    ]);
  }
  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="trips-report.csv"');
  res.send(csvContent);
});

app.get('/api/export/roi/csv', authenticate, (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const store = getTenantStore(tenantId);
  const rows = [
    ['Vehicle ID', 'Name', 'Registration Number', 'Type', 'Acquisition Cost (INR)', 'Current Odometer (km)', 'Status']
  ];
  for (const v of store.vehicles) {
    rows.push([
      v.id,
      v.name,
      v.registrationNumber,
      v.type,
      String(v.acquisitionCost || 0),
      String(v.currentOdometerKm || 0),
      v.status
    ]);
  }
  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="roi-matrix.csv"');
  res.send(csvContent);
});

// 9. Real-Time Events (Server-Sent Events)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  eventClients.add(res);

  req.on('close', () => {
    eventClients.delete(res);
  });
});

// ======================== MOUNT VITE / STATIC ========================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TransitOps] Full-Stack server operational on http://0.0.0.0:${PORT}`);
  });
}

startServer();
