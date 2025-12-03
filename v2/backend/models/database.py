"""
Database models using SQLAlchemy ORM
Clean schema with proper relationships and constraints
"""
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    DateTime, Date, ForeignKey, CheckConstraint, Index, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import os

Base = declarative_base()

# ============================================================================
# LOCATION MODEL
# ============================================================================
class Location(Base):
    __tablename__ = 'locations'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    type = Column(String(10), nullable=False)  # HUB, WARD, REMOTE
    parent_hub_id = Column(Integer, ForeignKey('locations.id'), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    parent_hub = relationship('Location', remote_side=[id], backref='child_locations')
    users = relationship('User', back_populates='location', foreign_keys='User.location_id')
    vials = relationship('Vial', back_populates='location')
    stock_levels = relationship('StockLevel', back_populates='location', cascade='all, delete-orphan')

    # Constraints
    __table_args__ = (
        CheckConstraint("type IN ('HUB', 'WARD', 'REMOTE')", name='valid_location_type'),
        Index('idx_location_type', 'type'),
        Index('idx_location_active', 'is_active'),
    )

    def __repr__(self):
        return f"<Location(id={self.id}, name='{self.name}', type='{self.type}')>"


# ============================================================================
# USER MODEL
# ============================================================================
class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # PHARMACIST, PHARMACY_TECH, NURSE
    location_id = Column(Integer, ForeignKey('locations.id'), nullable=False)

    # Permissions
    can_delegate = Column(Boolean, default=False)
    is_supervisor = Column(Boolean, default=False)

    # Contact
    email = Column(String(100))
    mobile_number = Column(String(20))

    # Account status
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)

    # Password reset
    reset_token = Column(String(6), nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    location = relationship('Location', back_populates='users', foreign_keys=[location_id])
    audit_logs = relationship('AuditLog', back_populates='user')

    # Constraints
    __table_args__ = (
        CheckConstraint("role IN ('PHARMACIST', 'PHARMACY_TECH', 'NURSE')", name='valid_user_role'),
        Index('idx_username', 'username'),
        Index('idx_user_active', 'is_active'),
        Index('idx_user_location', 'location_id'),
    )

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


# ============================================================================
# DRUG MODEL
# ============================================================================
class Drug(Base):
    __tablename__ = 'drugs'

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, unique=True)
    category = Column(String(100))
    storage_temp = Column(String(50))  # "<25°C" or "2-8°C"
    unit_price = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    vials = relationship('Vial', back_populates='drug')
    stock_levels = relationship('StockLevel', back_populates='drug', cascade='all, delete-orphan')

    # Indexes
    __table_args__ = (
        Index('idx_drug_name', 'name'),
        Index('idx_drug_active', 'is_active'),
        Index('idx_drug_category', 'category'),
    )

    def __repr__(self):
        return f"<Drug(id={self.id}, name='{self.name}', price=${self.unit_price})>"


# ============================================================================
# STOCK LEVEL MODEL
# ============================================================================
class StockLevel(Base):
    __tablename__ = 'stock_levels'

    id = Column(Integer, primary_key=True)
    location_id = Column(Integer, ForeignKey('locations.id'), nullable=False)
    drug_id = Column(Integer, ForeignKey('drugs.id'), nullable=False)
    min_stock = Column(Integer, default=0, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    location = relationship('Location', back_populates='stock_levels')
    drug = relationship('Drug', back_populates='stock_levels')

    # Constraints
    __table_args__ = (
        CheckConstraint('min_stock >= 0', name='positive_min_stock'),
        Index('idx_stock_level_location', 'location_id'),
        Index('idx_stock_level_drug', 'drug_id'),
        # Unique constraint: One min_stock per drug per location
        Index('idx_unique_location_drug', 'location_id', 'drug_id', unique=True),
    )

    def __repr__(self):
        return f"<StockLevel(location_id={self.location_id}, drug_id={self.drug_id}, min={self.min_stock})>"


# ============================================================================
# VIAL MODEL (Individual Inventory Items)
# ============================================================================
class Vial(Base):
    __tablename__ = 'vials'

    id = Column(Integer, primary_key=True)
    asset_id = Column(String(100), unique=True, nullable=False)
    drug_id = Column(Integer, ForeignKey('drugs.id'), nullable=False)
    batch_number = Column(String(100), nullable=False)
    expiry_date = Column(Date, nullable=False)
    location_id = Column(Integer, ForeignKey('locations.id'), nullable=False)

    # Status
    status = Column(String(20), default='AVAILABLE', nullable=False)

    # Receipt info
    goods_receipt_number = Column(String(100))

    # Clinical use info
    patient_mrn = Column(String(50))
    clinical_notes = Column(Text)

    # Discard info
    discard_reason = Column(String(100))
    disposal_register_number = Column(String(100))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime)
    used_by = Column(Integer, ForeignKey('users.id'))

    # Versioning
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    drug = relationship('Drug', back_populates='vials')
    location = relationship('Location', back_populates='vials')
    user = relationship('User', foreign_keys=[used_by])
    transfer_items = relationship('TransferItem', back_populates='vial')

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('AVAILABLE', 'USED_CLINICAL', 'DISCARDED', 'IN_TRANSIT')",
            name='valid_vial_status'
        ),
        Index('idx_vial_asset_id', 'asset_id'),
        Index('idx_vial_status', 'status'),
        Index('idx_vial_location', 'location_id'),
        Index('idx_vial_drug', 'drug_id'),
        Index('idx_vial_expiry', 'expiry_date'),
        Index('idx_vial_batch', 'batch_number'),
        # Composite index for common queries
        Index('idx_vial_location_status', 'location_id', 'status'),
    )

    def __repr__(self):
        return f"<Vial(id={self.id}, asset_id='{self.asset_id}', status='{self.status}')>"


# ============================================================================
# TRANSFER MODEL
# ============================================================================
class Transfer(Base):
    __tablename__ = 'transfers'

    id = Column(Integer, primary_key=True)
    from_location_id = Column(Integer, ForeignKey('locations.id'), nullable=False)
    to_location_id = Column(Integer, ForeignKey('locations.id'), nullable=False)
    status = Column(String(20), default='PENDING', nullable=False)

    # Users involved
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    approved_by = Column(Integer, ForeignKey('users.id'))
    completed_by = Column(Integer, ForeignKey('users.id'))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Versioning
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    from_location = relationship('Location', foreign_keys=[from_location_id])
    to_location = relationship('Location', foreign_keys=[to_location_id])
    creator = relationship('User', foreign_keys=[created_by])
    approver = relationship('User', foreign_keys=[approved_by])
    completer = relationship('User', foreign_keys=[completed_by])
    items = relationship('TransferItem', back_populates='transfer', cascade='all, delete-orphan')

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')",
            name='valid_transfer_status'
        ),
        CheckConstraint('from_location_id != to_location_id', name='different_locations'),
        Index('idx_transfer_from', 'from_location_id'),
        Index('idx_transfer_to', 'to_location_id'),
        Index('idx_transfer_status', 'status'),
        Index('idx_transfer_created_at', 'created_at'),
    )

    def __repr__(self):
        return f"<Transfer(id={self.id}, from={self.from_location_id}, to={self.to_location_id}, status='{self.status}')>"


# ============================================================================
# TRANSFER ITEM MODEL (Junction table)
# ============================================================================
class TransferItem(Base):
    __tablename__ = 'transfer_items'

    id = Column(Integer, primary_key=True)
    transfer_id = Column(Integer, ForeignKey('transfers.id'), nullable=False)
    vial_id = Column(Integer, ForeignKey('vials.id'), nullable=False)

    # Relationships
    transfer = relationship('Transfer', back_populates='items')
    vial = relationship('Vial', back_populates='transfer_items')

    # Indexes
    __table_args__ = (
        Index('idx_transfer_item_transfer', 'transfer_id'),
        Index('idx_transfer_item_vial', 'vial_id'),
    )

    def __repr__(self):
        return f"<TransferItem(transfer_id={self.transfer_id}, vial_id={self.vial_id})>"


# ============================================================================
# AUDIT LOG MODEL
# ============================================================================
class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50))  # 'vial', 'transfer', 'user', etc.
    entity_id = Column(Integer)
    details = Column(Text)  # JSON string
    ip_address = Column(String(45))
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship('User', back_populates='audit_logs')

    # Indexes
    __table_args__ = (
        Index('idx_audit_user', 'user_id'),
        Index('idx_audit_timestamp', 'timestamp'),
        Index('idx_audit_action', 'action'),
        Index('idx_audit_entity', 'entity_type', 'entity_id'),
    )

    def __repr__(self):
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, action='{self.action}')>"


# ============================================================================
# SETTINGS MODEL (Per-location configuration)
# ============================================================================
class Settings(Base):
    __tablename__ = 'settings'

    id = Column(Integer, primary_key=True)
    location_id = Column(Integer, ForeignKey('locations.id'), nullable=False)

    # Printer settings
    printer_ip = Column(String(45))
    printer_port = Column(Integer, default=9100)
    label_width = Column(Integer, default=50)
    label_height = Column(Integer, default=25)
    margin_top = Column(Integer, default=0)
    margin_right = Column(Integer, default=0)

    # Notification settings
    email_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=False)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    location = relationship('Location')

    # Constraints
    __table_args__ = (
        Index('idx_settings_location', 'location_id', unique=True),
    )

    def __repr__(self):
        return f"<Settings(location_id={self.location_id})>"


# ============================================================================
# DATABASE SETUP FUNCTIONS
# ============================================================================
def get_engine(db_path=None):
    """Create SQLAlchemy engine"""
    if db_path is None:
        # Default to sys_data.db in current directory
        db_path = os.path.join(os.getcwd(), 'sys_data.db')

    return create_engine(
        f'sqlite:///{db_path}',
        connect_args={
            'check_same_thread': False,
            'timeout': 30
        },
        pool_pre_ping=True,
        echo=False  # Set to True for SQL debugging
    )


def get_session(engine):
    """Create session factory"""
    Session = sessionmaker(bind=engine)
    return Session()


def init_database(engine):
    """Create all tables"""
    Base.metadata.create_all(engine)
    print("✅ Database tables created successfully")


def drop_all_tables(engine):
    """Drop all tables (use with caution!)"""
    Base.metadata.drop_all(engine)
    print("⚠️ All tables dropped")


# ============================================================================
# SEED DATA FUNCTION
# ============================================================================
def seed_initial_data(session):
    """Populate database with initial data"""
    from argon2 import PasswordHasher
    ph = PasswordHasher()

    # Create Hubs
    pa_hub = Location(name='Port Augusta Hospital Pharmacy', type='HUB')
    wh_hub = Location(name='Whyalla Hospital Pharmacy', type='HUB')
    session.add_all([pa_hub, wh_hub])
    session.flush()

    # Create Wards
    wards = [
        Location(name='Port Augusta ED', type='WARD', parent_hub_id=pa_hub.id),
        Location(name='Whyalla HDU', type='WARD', parent_hub_id=wh_hub.id),
        Location(name='Whyalla ED', type='WARD', parent_hub_id=wh_hub.id),
    ]
    session.add_all(wards)

    # Create Remote Sites
    remote_sites = [
        Location(name='Roxby Downs', type='REMOTE', parent_hub_id=pa_hub.id),
        Location(name='Quorn', type='REMOTE', parent_hub_id=pa_hub.id),
        Location(name='Hawker', type='REMOTE', parent_hub_id=pa_hub.id),
        Location(name='Leigh Creek', type='REMOTE', parent_hub_id=pa_hub.id),
        Location(name='Oodnadatta', type='REMOTE', parent_hub_id=pa_hub.id),
    ]
    session.add_all(remote_sites)
    session.flush()

    # Create Drugs
    drugs = [
        Drug(name='Tenecteplase', category='Thrombolytic', storage_temp='<25°C', unit_price=2500.00),
        Drug(name='Red Back Spider Antivenom', category='Antivenom', storage_temp='2-8°C', unit_price=850.00),
        Drug(name='Brown Snake Antivenom', category='Antivenom', storage_temp='2-8°C', unit_price=1200.00),
    ]
    session.add_all(drugs)
    session.flush()

    # Create Admin User
    admin = User(
        username='admin',
        password_hash=ph.hash('admin123'),
        role='PHARMACIST',
        location_id=pa_hub.id,
        can_delegate=True,
        is_supervisor=True,
        email='admin@funlhn.health'
    )
    session.add(admin)

    # Create Stock Levels (min stock for each drug at each location)
    locations = session.query(Location).all()
    for location in locations:
        for drug in drugs:
            min_stock = 10 if location.type == 'HUB' else 2
            stock_level = StockLevel(
                location_id=location.id,
                drug_id=drug.id,
                min_stock=min_stock
            )
            session.add(stock_level)

    session.commit()
    print("✅ Initial data seeded successfully")


if __name__ == '__main__':
    # Test database creation
    engine = get_engine('test.db')
    init_database(engine)
    session = get_session(engine)
    seed_initial_data(session)
    print("✅ Test database created and seeded!")
