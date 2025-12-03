# 🚀 QUICKSTART GUIDE - Medicine Tracker v2.0

**Get the app running in 5 minutes!**

---

## 📋 Prerequisites

- **Python 3.9+** (check: `python --version`)
- **Node.js 18+** (check: `node --version`)
- **pip** (Python package manager)
- **npm** (Node package manager)

---

## ⚡ Quick Setup

### 1. **Backend Setup** (2 minutes)

```bash
# Navigate to backend
cd v2/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python app.py
```

**Expected Output:**
```
✅ Database tables created successfully
✅ Initial data seeded successfully
🚀 Starting Flask server on http://127.0.0.1:5000
```

The backend will:
- Create `sys_data.db` database
- Seed initial data (locations, drugs, admin user)
- Start on port 5000 (or next available port)
- Open browser automatically

**Default Login:**
- Username: `admin`
- Password: `admin123`

---

### 2. **Frontend Setup** (3 minutes)

```bash
# Open NEW terminal window
# Navigate to frontend
cd v2/frontend-v2

# Install dependencies
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
  VITE v5.0.7  ready in 1234 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Open browser to **http://localhost:3000**

---

## 🎉 You're Ready!

### Login Screen
1. Navigate to http://localhost:3000/login
2. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Login"

### Dashboard
- View stock statistics
- See stock levels by location
- Check expiry status

---

## 🗂️ Initial Data

The database is seeded with:

### Locations
- **Hubs:** Port Augusta Hospital Pharmacy, Whyalla Hospital Pharmacy
- **Wards:** Port Augusta ED, Whyalla HDU, Whyalla ED
- **Remote Sites:** Roxby Downs, Quorn, Hawker, Leigh Creek, Oodnadatta

### Drugs
- Tenecteplase ($2,500)
- Red Back Spider Antivenom ($850)
- Brown Snake Antivenom ($1,200)

### Users
- **admin** (Pharmacist, Port Augusta, Supervisor)

### Stock Levels
- Minimum stock levels configured for all drugs at all locations

---

## 🛠️ Development Workflow

### Backend Development
```bash
# Backend runs on http://127.0.0.1:5000
# API endpoints: http://127.0.0.1:5000/api/*

# View logs
tail -f app.log

# Reset database
python -c "from models.database import *; engine = get_engine('sys_data.db'); drop_all_tables(engine); init_database(engine); session = get_session(engine); seed_initial_data(session)"
```

### Frontend Development
```bash
# Hot reload enabled - changes update instantly
# API calls proxy to backend automatically

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📡 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/change_password` - Change password
- `POST /api/heartbeat` - Keep server alive

### Stock
- `GET /api/dashboard/:userId` - Dashboard data
- `POST /api/receive_stock` - Receive stock from supplier
- `POST /api/use_stock` - Mark as used (clinical)
- `POST /api/discard_stock` - Mark as discarded
- `GET /api/stock_search` - Search stock
- `GET /api/stock_journey/:assetId` - Stock timeline

### Transfers
- `POST /api/create_transfer` - Create transfer
- `POST /api/transfer/:id/approve` - Approve transfer
- `POST /api/transfer/:id/complete` - Complete transfer
- `POST /api/transfer/:id/cancel` - Cancel transfer
- `GET /api/transfers/:locationId` - Get transfers

### Admin
- CRUD for Users, Drugs, Locations, Stock Levels, Settings

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.9+

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt

# Check port availability
netstat -an | grep 5000
```

### Frontend won't start
```bash
# Check Node version
node --version  # Should be 18+

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try different port
npm run dev -- --port 3001
```

### Database locked error
```bash
# Close all connections to database
# Delete sys_data.db and restart backend
rm sys_data.db
python app.py
```

### API calls failing
```bash
# Check backend is running
curl http://127.0.0.1:5000/api/health

# Check CORS headers
# Vite proxy should handle this automatically
```

---

## 🎨 Features Available

### ✅ Working
- User authentication
- Dashboard with stats
- Dark mode
- Responsive sidebar
- Backend API (all endpoints)
- Database with seed data
- Optimistic locking
- Write queue for concurrency
- Heartbeat monitoring
- Automatic backups

### 🚧 Coming Soon
- Stock receive UI
- Transfer creation UI
- Network map visualization
- Reports & analytics
- Batch operations
- QR scanner
- Label printing
- Email/SMS notifications

---

## 📚 Next Steps

1. **Explore the API** - Use Postman or curl to test endpoints
2. **Add Stock** - Use POST /api/receive_stock to add items
3. **Create Users** - Use POST /api/users to add more users
4. **Test Transfers** - Create transfers between locations
5. **View Reports** - Check usage and wastage (API ready, UI pending)

---

## 🤝 Need Help?

- **Backend Issues:** Check `app.log` for errors
- **Frontend Issues:** Check browser console (F12)
- **Database Issues:** Delete `sys_data.db` and restart

---

## 🎯 Production Deployment

See `README.md` for full deployment instructions including:
- PyInstaller build process
- Network drive deployment
- Multi-user configuration
- Backup strategies

---

**Happy tracking! 🏥💊**
