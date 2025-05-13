"""
IntelligenceBank OAuth Client
A Python SDK for the IntelligenceBank OAuth service
"""

import json
import time
import secrets
import requests
from typing import Optional, Dict, Any
from dataclasses import dataclass
from urllib.parse import urlencode

@dataclass
class OAuthConfig:
    client_id: str
    redirect_uri: str
    base_url: str = "https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev"
    scope: str = "profile"

class TokenStorage:
    """Abstract base class for token storage"""
    def store_tokens(self, tokens: Dict[str, Any]) -> None:
        raise NotImplementedError

    def get_tokens(self) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def clear_tokens(self) -> None:
        raise NotImplementedError

class FileTokenStorage(TokenStorage):
    """Simple file-based token storage"""
    def __init__(self, file_path: str):
        self.file_path = file_path

    def store_tokens(self, tokens: Dict[str, Any]) -> None:
        tokens['stored_at'] = time.time()
        with open(self.file_path, 'w') as f:
            json.dump(tokens, f)

    def get_tokens(self) -> Optional[Dict[str, Any]]:
        try:
            with open(self.file_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    def clear_tokens(self) -> None:
        try:
            import os
            os.remove(self.file_path)
        except FileNotFoundError:
            pass

class SessionExpiredError(Exception):
    """Raised when the session has expired"""
    pass

class TokenRefreshError(Exception):
    """Raised when token refresh fails"""
    pass

class IBOAuthClient:
    """
    IntelligenceBank OAuth client for Python applications
    
    Example:
        >>> config = OAuthConfig(
        ...     client_id="your_client_id",
        ...     redirect_uri="https://your-app.com/callback"
        ... )
        >>> client = IBOAuthClient(config)
        >>> auth_url = client.get_auth_url()
        >>> # Redirect user to auth_url
        >>> tokens = client.handle_callback(code="auth_code")
        >>> response = client.request("company.intelligencebank.com/api/3.0.0/users")
    """

    def __init__(self, config: OAuthConfig, storage: Optional[TokenStorage] = None):
        """
        Initialize the OAuth client
        
        Args:
            config: OAuth configuration
            storage: Optional token storage implementation
        """
        self.config = config
        self.storage = storage or FileTokenStorage(".ib_tokens.json")
        self.session = requests.Session()

    def get_auth_url(self, platform_url: Optional[str] = None) -> str:
        """
        Get the authorization URL
        
        Args:
            platform_url: Optional IntelligenceBank platform URL
        
        Returns:
            The full authorization URL
        """
        params = {
            'response_type': 'code',
            'client_id': self.config.client_id,
            'redirect_uri': self.config.redirect_uri,
            'scope': self.config.scope,
            'state': secrets.token_hex(16)
        }
        
        if platform_url:
            params['platform_url'] = platform_url
            
        return f"{self.config.base_url}/authorize?{urlencode(params)}"

    def handle_callback(self, code: str) -> Dict[str, Any]:
        """
        Handle OAuth callback and exchange code for tokens
        
        Args:
            code: Authorization code from callback
            
        Returns:
            Token response dictionary
            
        Raises:
            requests.exceptions.RequestException: If token exchange fails
        """
        tokens = self._exchange_code(code)
        self.storage.store_tokens(tokens)
        return tokens

    def request(self, path: str, method: str = 'GET', **kwargs) -> requests.Response:
        """
        Make an authenticated API request
        
        Args:
            path: API path (without https://)
            method: HTTP method
            **kwargs: Additional arguments passed to requests
            
        Returns:
            API response
            
        Raises:
            SessionExpiredError: If the session has expired
            requests.exceptions.RequestException: For other request errors
        """
        tokens = self.storage.get_tokens()
        if not tokens:
            raise ValueError("No tokens available")

        # Add authorization header
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f"Bearer {tokens['access_token']}"
        kwargs['headers'] = headers

        try:
            response = self.session.request(
                method,
                f"{self.config.base_url}/proxy/{path}",
                **kwargs
            )

            if response.status_code == 401:
                error = response.json()
                if error.get('error') == 'invalid_token':
                    if 'Session has expired' in error.get('error_description', ''):
                        self._handle_session_expiry()
                        raise SessionExpiredError("Session has expired")

                    # Try token refresh
                    new_tokens = self._refresh_tokens(tokens['refresh_token'])
                    self.storage.store_tokens(new_tokens)

                    # Retry request with new token
                    headers['Authorization'] = f"Bearer {new_tokens['access_token']}"
                    return self.session.request(
                        method,
                        f"{self.config.base_url}/proxy/{path}",
                        **kwargs
                    )

            response.raise_for_status()
            return response

        except requests.exceptions.RequestException as e:
            self._handle_error(e)
            raise

    def logout(self) -> None:
        """Clear stored tokens and end the session"""
        self.storage.clear_tokens()
        self.session.close()

    def _exchange_code(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens"""
        response = self.session.post(
            f"{self.config.base_url}/token",
            json={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': self.config.redirect_uri,
                'client_id': self.config.client_id
            }
        )
        response.raise_for_status()
        return response.json()

    def _refresh_tokens(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token"""
        try:
            response = self.session.post(
                f"{self.config.base_url}/token",
                json={
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token,
                    'client_id': self.config.client_id
                }
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise TokenRefreshError("Token refresh failed") from e

    def _handle_session_expiry(self) -> None:
        """Handle session expiry"""
        self.storage.clear_tokens()

    def _handle_error(self, error: Exception) -> None:
        """Handle request errors"""
        if isinstance(error, requests.exceptions.HTTPError):
            if error.response.status_code == 401:
                error_data = error.response.json()
                if error_data.get('error') == 'invalid_token':
                    if 'Session has expired' in error_data.get('error_description', ''):
                        self._handle_session_expiry()