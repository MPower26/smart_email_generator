import React, { useState, useEffect, useContext } from 'react';
import { Button, Offcanvas, Form, ListGroup, Badge, Spinner, Alert, FormCheck } from 'react-bootstrap';
import { FaUserFriends, FaUserPlus, FaCheck, FaTimes } from 'react-icons/fa';
import { friendService } from '../services/friend.service';
import { UserContext } from '../contexts/UserContext';
import '../styles/FriendsButton.css';

const FriendsButton = () => {
  const { userProfile, authenticated } = useContext(UserContext);
  
  // State for button and side panel
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'add'
  
  // States for data
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [newFriendEmail, setNewFriendEmail] = useState('');
  
  // States for error handling and loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Close side panel
  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setLoading(false);
    setShow(false);
  };
  
  // Open side panel
  const handleShow = () => {
    if (!authenticated) return;
    setShow(true);
    loadFriendsData();
  };
  
  // Load friends data
  const loadFriendsData = async () => {
    if (!authenticated) {
      setError("Authentication required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get friends list
      const friendsResponse = await friendService.getFriendsList();
      setFriends(friendsResponse.data || []);
      
      // Get pending requests
      const requestsResponse = await friendService.getFriendRequests();
      setPendingRequests(requestsResponse.data || []);
    } catch (err) {
      setError("Failed to load friends data");
    } finally {
      setLoading(false);
    }
  };
  
  // Send friend request
  const handleSendRequest = async (e) => {
    e.preventDefault();
    
    if (!authenticated || !newFriendEmail) {
      return;
    }

    // Clear any existing messages
    setError(null);
    setSuccess(null);

    // Check if trying to add self
    if (newFriendEmail.toLowerCase() === userProfile.email.toLowerCase()) {
      setError("You cannot send a friend request to yourself");
      return;
    }

    // Check if already friends or has pending request
    const isAlreadyFriend = friends.some(friend => 
      friend.email.toLowerCase() === newFriendEmail.toLowerCase()
    );
    
    if (isAlreadyFriend) {
      setError("You are already friends with this user");
      return;
    }

    const hasPendingRequest = pendingRequests.some(request => 
      request.email.toLowerCase() === newFriendEmail.toLowerCase()
    );
    
    if (hasPendingRequest) {
      setError("You already have a pending friend request with this user");
      return;
    }
    
    try {
      await friendService.sendFriendRequest(newFriendEmail);
      // Show success message
      setSuccess("Friend request sent successfully");
      // Clear the email input
      setNewFriendEmail('');
    } catch (err) {
      console.error('[FriendsButton] Error sending friend request:', err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to send friend request");
      }
    }
  };
  
  // Accept friend request
  const handleAcceptRequest = async (requestId) => {
    if (!authenticated) {
      setError("Authentication required");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await friendService.respondToFriendRequest(requestId, 'accepted');
      setSuccess("Friend request accepted");
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      setError("Failed to accept friend request");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Reject friend request
  const handleRejectRequest = async (requestId) => {
    if (!authenticated) {
      setError("Authentication required");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await friendService.respondToFriendRequest(requestId, 'rejected');
      setSuccess("Friend request rejected");
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      setError("Failed to reject friend request");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Remove friend
  const handleRemoveFriend = async (friendId) => {
    if (!authenticated) {
      setError("Authentication required");
      return;
    }
    
    if (!window.confirm("Are you sure you want to remove this friend?")) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // First, if the friend is currently sharing contacts, turn off sharing
      const friend = friends.find(f => f.id === friendId);
      if (friend && friend.combine_contacts) {
        const toggleResponse = await friendService.toggleCacheSharing(friendId, false);
        // Emit event with updated emails from toggle response
        if (toggleResponse.data?.updated_emails) {
          const event = new CustomEvent('emailsUpdated', {
            detail: toggleResponse.data.updated_emails
          });
          window.dispatchEvent(event);
        }
      }
      
      // Then remove the friend
      const removeResponse = await friendService.removeFriend(friendId);
      
      // If the backend returned updated emails from remove response, emit the event
      if (removeResponse.data?.updated_emails) {
        const event = new CustomEvent('emailsUpdated', {
          detail: removeResponse.data.updated_emails
        });
        window.dispatchEvent(event);
      }
      
      setSuccess("Friend removed successfully");
      
      // Reload data
      await loadFriendsData();
    } catch (err) {
      setError("Failed to remove friend");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle sharing with a friend
  const handleToggleSharing = async (friendId, currentStatus) => {
    if (!authenticated) {
      setError("Authentication required");
      return;
    }
    
    try {
      const response = await friendService.toggleCacheSharing(friendId, !currentStatus);
      
      // Emit an event with the updated emails
      if (response.data.updated_emails) {
        const event = new CustomEvent('emailsUpdated', {
          detail: response.data.updated_emails
        });
        window.dispatchEvent(event);
      }
      
      // Reload friends data
      await loadFriendsData();
    } catch (err) {
      setError("Failed to update sharing settings");
      console.error(err);
    }
  };
  
  // Change tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
  };
  
  // Effect to handle authentication changes
  useEffect(() => {
    if (!authenticated) {
      setShow(false);
      setFriends([]);
      setPendingRequests([]);
      setError(null);
      setSuccess(null);
      setNewFriendEmail('');
      setActiveTab('friends');
    }
  }, [authenticated]);
  
  // Add cleanup function
  useEffect(() => {
    return () => {
      setError(null);
      setSuccess(null);
      setLoading(false);
    };
  }, []);
  
  // Message cleanup effect
  useEffect(() => {
    let timer;
    if (error || success) {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        requestAnimationFrame(() => {
          setError(null);
          setSuccess(null);
        });
      }, 3000);
    }
    
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [error, success]);
  
  // Load friends data when panel is shown
  useEffect(() => {
    if (show && authenticated) {
      loadFriendsData();
    }
  }, [show, authenticated]);
  
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
      <Offcanvas 
        show={show}
        onHide={handleClose} 
        placement="end"
        backdrop={true}
        keyboard={true}
        onExited={() => {
          setError(null);
          setSuccess(null);
          setLoading(false);
          setActiveTab('friends');
        }}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Friends</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {/* Navigation between tabs */}
          <div className="friends-tabs">
            <Button 
              variant={activeTab === 'friends' ? 'primary' : 'outline-primary'} 
              onClick={() => handleTabChange('friends')}
              className="me-2"
            >
              My Friends
              {friends.length > 0 && <Badge bg="secondary" className="ms-2">{friends.length}</Badge>}
            </Button>
            <Button 
              variant={activeTab === 'requests' ? 'primary' : 'outline-primary'} 
              onClick={() => handleTabChange('requests')}
              className="me-2"
              disabled={pendingRequests.length === 0}
            >
              Requests
              {pendingRequests.length > 0 && <Badge bg="danger" className="ms-2">{pendingRequests.length}</Badge>}
            </Button>
            <Button 
              variant={activeTab === 'add' ? 'primary' : 'outline-primary'} 
              onClick={() => handleTabChange('add')}
            >
              Add Friend
            </Button>
          </div>
          
          {/* Error and success messages */}
          <div className="messages-container">
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success" role="alert">
                {success}
              </div>
            )}
          </div>
          
          {/* Tab content */}
          <div className="friends-content mt-4">
            {/* My friends tab */}
            {activeTab === 'friends' && (
              <div>
                <h5>Friends ({friends.length})</h5>
                {friends.length === 0 ? (
                  <p className="text-muted">You don't have any friends yet.</p>
                ) : (
                  <ListGroup>
                    {friends.map((friend) => (
                      <ListGroup.Item key={friend.id}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold">{friend.name || friend.email}</div>
                            <div className="text-muted small">{friend.email}</div>
                          </div>
                          <div className="d-flex align-items-center">
                            <div className="d-flex align-items-center switch-container">
                              <FormCheck
                                type="switch"
                                id={`share-${friend.id}`}
                                checked={friend.combine_contacts}
                                onChange={() => handleToggleSharing(friend.id, friend.combine_contacts)}
                                disabled={loading}
                              />
                            </div>
                            <Button 
                              variant="link" 
                              className="ms-3 p-0 delete-friend-btn d-flex align-items-center" 
                              onClick={() => handleRemoveFriend(friend.id)}
                              disabled={loading}
                            >
                              <FaTimes size={18} />
                            </Button>
                          </div>
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
                <h5>Friend Requests ({pendingRequests.length})</h5>
                {pendingRequests.length === 0 ? (
                  <p className="text-muted">No pending friend requests.</p>
                ) : (
                  <ListGroup>
                    {pendingRequests.map((request) => (
                      <ListGroup.Item key={request.id} className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-bold">{request.name || request.email}</div>
                          <div className="text-muted small">{request.email}</div>
                        </div>
                        <div>
                          <Button 
                            variant="link" 
                            className="me-2 p-0 text-success" 
                            onClick={() => handleAcceptRequest(request.id)}
                            disabled={loading}
                          >
                            <FaCheck size={18} title="Accept" />
                          </Button>
                          <Button 
                            variant="link" 
                            className="p-0 text-danger" 
                            onClick={() => handleRejectRequest(request.id)}
                            disabled={loading}
                          >
                            <FaTimes size={18} title="Reject" />
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
                <h5>Add a Friend</h5>
                <Form onSubmit={handleSendRequest}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email Address</Form.Label>
                    <Form.Control 
                      type="email" 
                      placeholder="friend@example.com" 
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
                        <FaUserPlus className="me-2" /> Send Friend Request
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
