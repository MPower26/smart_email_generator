# This file makes the models directory a Python package 

from .models import (
    User, VerificationCode, EmailTemplate, GeneratedEmail, 
    EmailGenerationProgress, Attachment, SentHistory, FriendRequest
)
from .anti_spam_models import (
    EmailDailyLimit, SenderReputation, AuthorizedDomain, 
    EmailSendLog, EmailLimitRule
)
from .domain_auth_models import (
    Domain, DomainAuthCheck, DomainAlert
) 
