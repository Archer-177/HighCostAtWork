import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, Save, X, ChevronDown, ChevronRight, Building2, MapPin, Heart, Edit2, Shield, User, Trash2,
  Pill, Users, Check, AlertCircle, DollarSign, Thermometer, Hash, Printer
} from 'lucide-react';
import useAppStore from '../stores/appStore';
import { useNotification } from '../contexts/NotificationContext';
import DrugsCatalogue from './settings/DrugsCatalogue';
import LocationsManagement from './settings/LocationsManagement';
import UsersManagement from './settings/UsersManagement';
import PrinterSettings from './settings/PrinterSettings';
import SecuritySettings from './settings/SecuritySettings';
import ConfirmationModal from './settings/ConfirmationModal';
import Modal from './settings/Modal';

export default function Settings() {
  const user = useAppStore((state) => state.user);
  const { success, error: showError } = useNotification();

  const [activeTab, setActiveTab] = useState('drugs');
  const [drugs, setDrugs] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, type: '', item: null });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();

      if (activeTab === 'users') {
        const [usersRes, locationsRes] = await Promise.all([
          fetch(`/api/users?t=${timestamp}`),
          fetch(`/api/locations?t=${timestamp}`)
        ]);

        if (usersRes.ok && locationsRes.ok) {
          setUsers(await usersRes.json());
          setLocations(await locationsRes.json());
        }
      } else {
        let endpoint = '';
        switch (activeTab) {
          case 'drugs':
            endpoint = '/api/drugs';
            break;
          case 'locations':
            endpoint = '/api/locations';
            break;
        }

        if (endpoint) {
          const response = await fetch(`${endpoint}?t=${timestamp}`);
          const data = await response.json();

          if (response.ok) {
            if (activeTab === 'drugs') setDrugs(data);
            if (activeTab === 'locations') setLocations(data);
          }
        }
      }
    } catch (err) {
      showError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (type, item = null) => {
    setModalType(type);
    setEditItem(item);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditItem(null);
    setModalType('');
  };

  const handleDeleteRequest = (type, item) => {
    setDeleteModal({ show: true, type, item });
  };

  const handleConfirmDelete = async () => {
    const { type, item } = deleteModal;
    if (!item) return;

    try {
      const endpoint = type === 'drug' ? `/api/drugs/${item.id}`
        : type === 'location' ? `/api/locations/${item.id}`
          : `/api/users/${item.id}`;

      const response = await fetch(endpoint, { method: 'DELETE' });

      if (response.ok) {
        success(`${type.charAt(0).toUpperCase() + type.slice(1)} Deleted`, 'Item has been removed successfully');
        setDeleteModal({ show: false, type: '', item: null });
        fetchData();
      } else {
        const data = await response.json();
        showError('Delete Failed', data.error || 'Could not delete item');
        setDeleteModal({ show: false, type: '', item: null }); // Close modal on error too? Or keep open? Better close and show error.
      }
    } catch (err) {
      showError('Delete Failed', 'An error occurred while deleting');
      setDeleteModal({ show: false, type: '', item: null });
    }
  };

  const tabs = [
    { id: 'drugs', label: 'Medicine Catalogue', icon: Pill },
    { id: 'locations', label: 'Locations', icon: Building2 },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'printer', label: 'Printer', icon: Printer },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  return (
    <div className="min-h-screen p-6 bg-sand-50 dark:bg-gray-900 text-slate-900 dark:text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-display tracking-wider gradient-text mb-2">
          System Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage medicines, locations, users, and system configuration
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id
                ? 'bg-maroon-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {activeTab === 'drugs' && (
              <motion.div
                key="drugs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DrugsCatalogue
                  drugs={drugs}
                  onAdd={() => handleOpenModal('drug')}
                  onEdit={(drug) => handleOpenModal('drug', drug)}
                  onDelete={(drug) => handleDeleteRequest('drug', drug)}
                  currentUser={user}
                />
              </motion.div>
            )}

            {activeTab === 'locations' && (
              <motion.div
                key="locations"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LocationsManagement
                  locations={locations}
                  onAdd={() => handleOpenModal('location')}
                  onEdit={(location) => handleOpenModal('location', location)}
                  onDelete={(location) => handleDeleteRequest('location', location)}
                  currentUser={user}
                />
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <UsersManagement
                  users={users}
                  onAdd={() => handleOpenModal('user')}
                  onEdit={(user) => handleOpenModal('user', user)}
                  onDelete={(user) => handleDeleteRequest('user', user)}
                  currentUser={user}
                />
              </motion.div>
            )}

            {activeTab === 'printer' && (
              <motion.div
                key="printer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <PrinterSettings />
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SecuritySettings currentUser={user} />
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Modal */}
      {showModal && (
        <Modal
          type={modalType}
          item={editItem}
          locations={locations}
          currentUser={user}
          onClose={handleCloseModal}
          onSuccess={() => {
            handleCloseModal();
            fetchData();
          }}
        />
      )}

      {/* Confirmation Modal */}
      {deleteModal.show && (
        <ConfirmationModal
          isOpen={deleteModal.show}
          title={`Delete ${deleteModal.type.charAt(0).toUpperCase() + deleteModal.type.slice(1)}`}
          message={`Are you sure you want to delete ${deleteModal.type === 'user' ? deleteModal.item.username : deleteModal.item.name}? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ show: false, type: '', item: null })}
        />
      )}
    </div>
  );
}
