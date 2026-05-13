import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Send, Check, AlertCircle } from "lucide-react";

interface PortalMessengerProps {
  encounterId: string;
  patientId: string;
}

export default function PortalMessenger({ encounterId, patientId }: PortalMessengerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["portal", "email"]);

  // Queries
  const messages = useQuery(api.portal.getEncounterMessages, { encounterId: encounterId as any });
  const preferences = useQuery(api.portal.getPatientCommunicationPreferences, { patientId: patientId as any });

  // Mutations
  const generateDischargeSummary = useMutation(api.portal.generateDischargeSummary);
  const generateMedicationList = useMutation(api.portal.generateMedicationList);
  const sendMessage = useMutation(api.portal.sendPortalMessage);

  const handleGenerateSummary = async () => {
    try {
      await generateDischargeSummary({
        encounterId: encounterId as any,
        patientId: patientId as any,
      });
    } catch (err) {
      console.error("Failed to generate summary", err);
    }
  };

  const handleSendMessages = async () => {
    if (!messages || messages.length === 0) return;

    const unsent = messages.filter((m) => !m.sentAt);
    for (const msg of unsent) {
      try {
        await sendMessage({
          messageId: msg._id,
          deliveryChannels: selectedChannels as any,
        });
      } catch (err) {
        console.error("Failed to send message", err);
      }
    }
  };

  if (!messages || !preferences) return <div>Loading portal data...</div>;

  const pendingCount = messages.filter((m) => !m.sentAt).length;
  const sentCount = messages.filter((m) => m.sentAt).length;

  const canSend =
    preferences.portalEnabled &&
    (preferences.emailOptIn || preferences.smsOptIn);

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Mail className="w-5 h-5" /> Patient Portal
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              {pendingCount} pending • {sentCount} sent
            </p>
          </div>
          <div className="text-2xl">{pendingCount > 0 ? pendingCount : "✓"}</div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Communication Preferences */}
          <div className="p-3 bg-blue-50 rounded">
            <p className="text-xs font-semibold text-blue-900 mb-2">Patient Preferences:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={preferences.portalEnabled ? "text-green-700" : "text-gray-500"}>
                ✓ Portal: {preferences.portalEnabled ? "Enabled" : "Disabled"}
              </div>
              <div className={preferences.emailOptIn ? "text-green-700" : "text-gray-500"}>
                ✓ Email: {preferences.emailOptIn ? "Opt-in" : "Opt-out"}
              </div>
              <div className={preferences.smsOptIn ? "text-green-700" : "text-gray-500"}>
                ✓ SMS: {preferences.smsOptIn ? "Opt-in" : "Opt-out"}
              </div>
              <div className="text-gray-700">
                🌐 Language: {preferences.preferredLanguage}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Messages</h4>
            {messages.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {messages.map((msg) => (
                  <div key={msg._id} className="p-3 bg-gray-50 rounded border text-xs">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-semibold text-sm">{msg.subject}</span>
                      {msg.sentAt ? (
                        <span className="text-green-600">✓ Sent</span>
                      ) : (
                        <span className="text-orange-600">⏱ Pending</span>
                      )}
                    </div>
                    <p className="text-gray-700 line-clamp-2">{msg.content}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px]">
                        {msg.messageType}
                      </span>
                      {msg.viewedAt && (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-[10px]">
                          Viewed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No messages yet</p>
            )}
          </div>

          {/* Quick Message Generation */}
          <div className="border-t pt-3">
            <h4 className="font-semibold text-sm mb-2">Generate Messages</h4>
            <div className="space-y-2">
              <button
                onClick={handleGenerateSummary}
                className="w-full px-3 py-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-medium"
              >
                Generate Discharge Summary
              </button>
              <button
                onClick={() => generateMedicationList({ encounterId: encounterId as any, patientId: patientId as any })}
                className="w-full px-3 py-2 text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 rounded font-medium"
              >
                Generate Medication List
              </button>
            </div>
          </div>

          {/* Delivery Channels */}
          <div className="border-t pt-3">
            <h4 className="font-semibold text-sm mb-2">Delivery Channels</h4>
            <div className="grid grid-cols-2 gap-2">
              {["portal", "email", "sms", "push"].map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedChannels([...selectedChannels, channel]);
                      } else {
                        setSelectedChannels(selectedChannels.filter((c) => c !== channel));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="capitalize">{channel}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Send Button */}
          {pendingCount > 0 && (
            <button
              onClick={handleSendMessages}
              disabled={!canSend}
              className={`w-full px-4 py-2 rounded font-semibold flex items-center justify-center gap-2 ${
                canSend
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              }`}
            >
              <Send className="w-4 h-4" />
              Send {pendingCount} Message{pendingCount !== 1 ? "s" : ""}
            </button>
          )}

          {!canSend && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded flex gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <span className="text-yellow-800">Patient has opted out of communications</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
