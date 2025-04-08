import React, { useState, useEffect, useContext } from 'react';
import { Button, Offcanvas, Form, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { FaUserFriends, FaUserPlus, FaCheck, FaTimes, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext';
import '../styles/FriendsButton.css';

// URL de base de l'API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FriendsButton = () => {
  const { userProfile, authenticated } = useContext(UserContext);
  
  // State for button and side panel
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'add'
  
  // States for data
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  
  // States for error handling and loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Close side panel
  const handleClose = () => setShow(false);
  
  // Open side panel
  const handleShow = () => {
    if (!authenticated) return;
    setShow(true);
    loadFriendsData();
  };
  
  // Load friends data
  const loadFriendsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Récupérer la liste des amis
      const friendsResponse = await axios.get(`${API_URL}/api/friends/list`);
      setFriends(friendsResponse.data || []);
      
      // Récupérer les demandes d'amis
      const requestsResponse = await axios.get(`${API_URL}/api/friends/requests`);
      setPendingRequests(requestsResponse.data || []);
    } catch (err) {
      setError("Impossible de charger les données des amis");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Send friend request
  const handleSendRequest = async (e) => {
    e.preventDefault();
    
    if (!newFriendEmail) {
      setError("Veuillez entrer une adresse email");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await axios.post(`${API_URL}/api/friends/request`, { 
        friend_email: newFriendEmail 
      });
      setSuccess("Demande envoyée avec succès");
      setNewFriendEmail('');
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Erreur lors de l'envoi de la demande");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Accept friend request
  const handleAcceptRequest = async (requestId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await axios.post(`${API_URL}/api/friends/respond`, {
        request_id: requestId,
        status: 'accepted'
      });
      setSuccess("Demande acceptée");
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      setError("Erreur lors de l'acceptation de la demande");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Reject friend request
  const handleRejectRequest = async (requestId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await axios.post(`${API_URL}/api/friends/respond`, {
        request_id: requestId,
        status: 'rejected'
      });
      setSuccess("Demande rejetée");
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      setError("Erreur lors du rejet de la demande");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Remove friend
  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet ami ?")) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await axios.delete(`${API_URL}/api/friends/${friendId}`);
      setSuccess("Ami supprimé avec succès");
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      setError("Erreur lors de la suppression de l'ami");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Enable/disable sharing with a friend
  const handleToggleSharing = async (friendId, currentStatus) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await axios.post(`${API_URL}/api/friends/share/${friendId}`, { 
        share: !currentStatus 
      });
      setSuccess(`Partage ${!currentStatus ? 'activé' : 'désactivé'}`);
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      setError("Erreur lors du changement du statut de partage");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Change tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
  };
  
  // Clear messages after delay
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [error, success]);
  
  // Don't render if not authenticated
  if (!authenticated) return null;
  
  return (
    <>
      {/* Sticky button */}
      <Button 
        className="friends-button"
        onClick={handleShow}
        variant="dark"
      >
        <FaUserFriends size={24} />
        {pendingRequests.length > 0 && (
          <Badge pill bg="danger" className="friends-badge">
            {pendingRequests.length}
          </Badge>
        )}
      </Button>
      
      {/* Side panel */}
      <Offcanvas show={show} onHide={handleClose} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Gestion des amis</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {/* Navigation between tabs */}
          <div className="friends-tabs">
            <Button 
              variant={activeTab === 'friends' ? 'primary' : 'outline-primary'} 
              onClick={() => handleTabChange('friends')}
              className="me-2"
            >
              Mes amis
              {friends.length > 0 && <Badge bg="secondary" className="ms-2">{friends.length}</Badge>}
            </Button>
            <Button 
              variant={activeTab === 'requests' ? 'primary' : 'outline-primary'} 
              onClick={() => handleTabChange('requests')}
              className="me-2"
              disabled={pendingRequests.length === 0}
            >
              Demandes
              {pendingRequests.length > 0 && <Badge bg="danger" className="ms-2">{pendingRequests.length}</Badge>}
            </Button>
            <Button 
              variant={activeTab === 'add' ? 'primary' : 'outline-primary'} 
              onClick={() => handleTabChange('add')}
            >
              Ajouter
            </Button>
          </div>
          
          {/* Error and success messages */}
          {error && <div className="text-danger mt-3">{error}</div>}
          {success && <div className="text-success mt-3">{success}</div>}
          
          {/* Loading indicator */}
          {loading && (
            <div className="text-center mt-3">
              <Spinner animation="border" variant="primary" />
            </div>
          )}
          
          {/* Tab content */}
          <div className="friends-content mt-4">
            {/* My friends tab */}
            {activeTab === 'friends' && (
              <div>
                <h5>Amis ({friends.length})</h5>
                {friends.length === 0 ? (
                  <p className="text-muted">Vous n'avez pas encore d'amis.</p>
                ) : (
                  <ListGroup>
                    {friends.map((friend) => (
                      <ListGroup.Item key={friend.id} className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-bold">{friend.friend_name || friend.friend_email}</div>
                          <div className="text-muted small">{friend.friend_email}</div>
                        </div>
                        <div>
                          <Button 
                            variant="link" 
                            className="me-2 p-0" 
                            onClick={() => handleToggleSharing(friend.id, friend.share_cache)}
                            disabled={loading}
                          >
                            {friend.share_cache ? (
                              <FaToggleOn size={24} className="text-success" title="Désactiver le partage" />
                            ) : (
                              <FaToggleOff size={24} className="text-muted" title="Activer le partage" />
                            )}
                          </Button>
                          <Button 
                            variant="link" 
                            className="p-0 text-danger" 
                            onClick={() => handleRemoveFriend(friend.id)}
                            disabled={loading}
                          >
                            <FaTimes size={18} title="Supprimer" />
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>
            )}
            
            {/* Pending requests tab */}
            {activeTab === 'requests' && (
              <div>
                <h5>Demandes en attente ({pendingRequests.length})</h5>
                {pendingRequests.length === 0 ? (
                  <p className="text-muted">Aucune demande en attente.</p>
                ) : (
                  <ListGroup>
                    {pendingRequests.map((request) => (
                      <ListGroup.Item key={request.id} className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-bold">{request.sender_name || request.sender_email}</div>
                          <div className="text-muted small">{request.sender_email}</div>
                        </div>
                        <div>
                          <Button 
                            variant="link" 
                            className="me-2 p-0 text-success" 
                            onClick={() => handleAcceptRequest(request.id)}
                            disabled={loading}
                          >
                            <FaCheck size={18} title="Accepter" />
                          </Button>
                          <Button 
                            variant="link" 
                            className="p-0 text-danger" 
                            onClick={() => handleRejectRequest(request.id)}
                            disabled={loading}
                          >
                            <FaTimes size={18} title="Rejeter" />
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>
            )}
            
            {/* Add friend tab */}
            {activeTab === 'add' && (
              <div>
                <h5>Ajouter un ami</h5>
                <Form onSubmit={handleSendRequest}>
                  <Form.Group className="mb-3">
                    <Form.Label>Adresse email</Form.Label>
                    <Form.Control 
                      type="email" 
                      placeholder="ami@example.com" 
                      value={newFriendEmail}
                      onChange={(e) => setNewFriendEmail(e.target.value)}
                      required
                    />
                  </Form.Group>
                  
                  <Button 
                    type="submit" 
                    variant="primary" 
                    disabled={loading || !newFriendEmail}
                    className="w-100"
                  >
                    {loading ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <FaUserPlus className="me-2" /> Envoyer la demande
                      </>
                    )}
                  </Button>
                </Form>
              </div>
            )}
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default FriendsButton; 