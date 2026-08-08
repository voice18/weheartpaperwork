import { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  formatDateInput,
  inputToIso,
  isoToInput,
} from "../../lib/dateUtils";

type Props = {
  value: string;
  onSave: (isoDate: string) => void | Promise<void>;
  accessibilityLabel: string;
  width?: number;
};

export default function PersistedDateInput({
  value,
  onSave,
  accessibilityLabel,
  width = 160,
}: Props) {
  const initialDraft = isoToInput(value);

  const [draft, setDraft] = useState(initialDraft);
  const draftRef = useRef(initialDraft);

  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const savedTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextDraft = isoToInput(value);

    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setMessage(null);
  }, [value]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const savedInput = isoToInput(value);
  const hasChanges = draft !== savedInput;

  const draftIso = inputToIso(draft);

  const canSave =
    hasChanges &&
    !saving &&
    (draft === "" || Boolean(draftIso));

  const handleChangeText = (text: string) => {
    const formatted = formatDateInput(text);

    draftRef.current = formatted;
    setDraft(formatted);

    setMessage(null);
    setSaved(false);

    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  };

  const handleBlur = () => {
    const currentDraft = draftRef.current;

    if (!currentDraft) {
      setMessage(null);
      return;
    }

    const isoDate = inputToIso(currentDraft);

    if (!isoDate) {
      setMessage("Enter a valid date.");
      return;
    }

    setMessage(null);
  };

  const handleSave = async () => {
    if (saving || !hasChanges) {
      return;
    }

    const currentDraft = draftRef.current;

    let isoDate = "";

    if (currentDraft) {
      isoDate = inputToIso(currentDraft);

      if (!isoDate) {
        setMessage("Enter a valid date.");
        return;
      }
    }

    try {
      setSaving(true);
      setSaved(false);
      setMessage(null);

      await onSave(isoDate);

      setSaved(true);

      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }

      savedTimerRef.current = setTimeout(() => {
        setSaved(false);
      }, 1500);
    } catch (error) {
      console.error("Failed to save date:", error);
      setMessage("Could not save date. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TextInput
          accessibilityLabel={accessibilityLabel}
          placeholder="MM-DD-YYYY"
          placeholderTextColor="#706E68"
          value={draft}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType="number-pad"
          maxLength={10}
          selectionColor="#27500A"
          cursorColor="#27500A"
          style={{
            width,
            backgroundColor: "#FFFFFF",
            color: "#2B2A27",
            borderWidth: 1,
            borderColor: "#D3D1C7",
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        />

        <View
          style={{
            width: 90,
            marginLeft: 8,
            justifyContent: "center",
          }}
        >
          {saving ? (
            <Text
              style={{
                fontSize: 12,
                color: "#706E68",
                fontWeight: "500",
              }}
            >
              Saving...
            </Text>
          ) : saved ? (
            <Text
              style={{
                fontSize: 12,
                color: "#3B6D11",
                fontWeight: "600",
              }}
            >
              ✓ Saved
            </Text>
          ) : hasChanges ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                draft ? "Save date" : "Clear saved date"
              }
              activeOpacity={0.8}
              disabled={!canSave}
              onPress={handleSave}
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 7,
                borderWidth: 1,
                borderColor: canSave
                  ? "#C0DD97"
                  : "#DDDCD7",
                backgroundColor: canSave
                  ? "#EAF3DE"
                  : "#F3F2EF",
                opacity: canSave ? 1 : 0.65,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: canSave
                    ? "#27500A"
                    : "#8A8880",
                  fontWeight: "600",
                }}
              >
                {draft ? "Save date" : "Clear"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {message ? (
        <Text
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "#A32D2D",
          }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
