// src/components/GoogleCalendar.js
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, AlertCircle, Loader2 } from 'lucide-react';

const GoogleCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Google Calendar API設定
  const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

  const [gapi, setGapi] = useState(null);
  const [gisLoaded, setGisLoaded] = useState(false);

  useEffect(() => {
    initializeGapi();
  }, []);

  const initializeGapi = async () => {
    if (typeof window === 'undefined') return;

    try {
      // Google API Script の動的読み込み
      if (!window.gapi) {
        await loadScript('https://apis.google.com/js/api.js');
      }
      if (!window.google?.accounts) {
        await loadScript('https://accounts.google.com/gsi/client');
      }

      setGapi(window.gapi);
      await window.gapi.load('client', initializeGapiClient);
      setGisLoaded(true);
    } catch (err) {
      setError('Google APIの初期化に失敗しました');
      console.error('初期化エラー:', err);
    }
  };

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const initializeGapiClient = async () => {
    if (window.gapi) {
      try {
        await window.gapi.client.init({
          apiKey: '', // API Keyは不要ですが、初期化には必要な場合があります
          discoveryDocs: [DISCOVERY_DOC],
        });
        console.log('GAPI client初期化完了');
        setIsSignedIn(false);
      } catch (error) {
        console.error('GAPI client初期化エラー:', error);
        setError('Google APIクライアントの初期化に失敗しました');
      }
    }
  };

  const handleAuthClick = () => {
    if (!window.google?.accounts) {
      setError('Google Identity Services が読み込まれていません');
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          setError(`認証に失敗しました: ${tokenResponse.error}`);
          console.error('認証エラー:', tokenResponse);
          return;
        }
        console.log('認証成功:', tokenResponse);
        
        // アクセストークンを設定
        window.gapi.client.setToken({ access_token: tokenResponse.access_token });
        
        // Calendar APIクライアントを再初期化
        try {
          await window.gapi.client.load('calendar', 'v3');
          console.log('Calendar APIロード完了');
          setIsSignedIn(true);
          setError('');
          fetchMonthEvents();
        } catch (error) {
          console.error('Calendar APIロードエラー:', error);
          setError('Calendar APIの初期化に失敗しました');
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleSignoutClick = () => {
    if (window.gapi) {
      const token = window.gapi.client.getToken();
      if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token);
        window.gapi.client.setToken('');
        setIsSignedIn(false);
        setEvents([]);
      }
    }
  };

  const fetchMonthEvents = async () => {
    if (!window.gapi || !window.gapi.client || !window.gapi.client.calendar) {
      setError('Google Calendar APIが初期化されていません');
      console.error('GAPI状態:', {
        gapi: !!window.gapi,
        client: !!window.gapi?.client,
        calendar: !!window.gapi?.client?.calendar
      });
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      console.log('Calendar API呼び出しを開始...');
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      console.log('取得期間:', startOfMonth.toISOString(), 'から', endOfMonth.toISOString());

      const response = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfMonth.toISOString(),
        timeMax: endOfMonth.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      });

      console.log('API応答:', response);
      
      const items = response.result.items || [];
      console.log('取得した予定数:', items.length);
      setEvents(items);
      
      if (items.length === 0) {
        console.log('今月の予定はありません');
      }
    } catch (err) {
      console.error('Calendar API エラー:', err);
      console.error('エラー詳細:', err.result?.error);
      
      if (err.result?.error?.code === 403) {
        setError('Google Calendar APIへのアクセス権限がありません。Google Cloud ConsoleでCalendar APIが有効になっていることを確認してください。');
      } else if (err.result?.error?.code === 401) {
        setError('認証が無効です。再度ログインしてください。');
        setIsSignedIn(false);
      } else {
        setError(`予定の取得に失敗しました: ${err.result?.error?.message || err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return '終日';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const today = new Date().toLocaleDateString('ja-JP', { 
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">今月の予定</h1>
              <p className="text-gray-600">{today}</p>
            </div>
          </div>
          
          {!isSignedIn ? (
            <button
              onClick={handleAuthClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Googleアカウントでログイン
            </button>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={fetchMonthEvents}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                <span>更新</span>
              </button>
              <button
                onClick={handleSignoutClick}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ログアウト
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {!isSignedIn && !error && (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Googleカレンダーに接続</h3>
            <p className="text-gray-500">
              ログインして今月の予定を表示
            </p>
          </div>
        )}

        {isSignedIn && !loading && events.length === 0 && !error && (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">今月の予定はありません</h3>
            <p className="text-gray-500">
              予定がない期間ですね
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">予定を読み込んでいます...</p>
          </div>
        )}

        {events.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              今月の予定 ({events.length}件)
            </h2>
            {events.map((event, index) => (
              <div
                key={event.id || index}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 mb-2">
                      {event.summary || '無題の予定'}
                    </h3>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {event.start?.dateTime ? (
                            `${formatDate(event.start.dateTime)} ${formatTime(event.start.dateTime)} - ${formatTime(event.end?.dateTime)}`
                          ) : event.start?.date ? (
                            `${formatDate(event.start.date)} (終日)`
                          ) : (
                            '日時未定'
                          )}
                        </span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate max-w-xs">{event.location}</span>
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                  
                  {event.htmlLink && (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium ml-4"
                    >
                      詳細
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleCalendar;