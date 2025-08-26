from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import uuid
import traceback
from .models import Conversation
from ml_engine.chat_model import chat_model

@api_view(['POST'])
@permission_classes([AllowAny])
def chat_message(request):
    try:
        data = request.data or {}
        user_message = data.get('message', '') or ''
        session_id = data.get('session_id', str(uuid.uuid4()))

        ai_result = chat_model.get_response(user_message)

        try:
            Conversation.objects.create(
                session_id=session_id,
                user_message=user_message,
                bot_response=ai_result.get('response', ''),
                intent=ai_result.get('intent', ''),
                confidence=ai_result.get('confidence', 0.0)
            )
        except Exception:
            traceback.print_exc()

        return Response(ai_result)
    except Exception as e:
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)
