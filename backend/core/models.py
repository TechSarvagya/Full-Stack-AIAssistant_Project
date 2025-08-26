from django.db import models 
from django.contrib.auth.models import User 
 
class Conversation(models.Model): 
    session_id = models.CharField(max_length=100) 
    user_message = models.TextField() 
    bot_response = models.TextField() 
    intent = models.CharField(max_length=50, null=True) 
    confidence = models.FloatField(null=True) 
    created_at = models.DateTimeField(auto_now_add=True) 
 
    def __str__(self): 
        return f"Chat: {self.user_message[:30]}..." 
