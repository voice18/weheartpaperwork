import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { formatDateInput } from "../../../../lib/dateUtils";
import {
  addDays,
  addYears,
  daysFrom,
  localDateString,
} from "../../../../lib/requirements";
type Props = {
  label: string;
  value: string;
  years?: number;
  days?: number;
  onChange: (value: string) => void;
  onMarkComplete?: (nextDue: string) => void;
};


function addInterval(dateStr: string, years = 0, days = 0) {
  if (!dateStr) return "";

  if (years) {
    return addYears(dateStr, years);
  }

  if (days) {
    return addDays(dateStr, days);
  }

  return dateStr;
}


function getBadge(daysLeft: number | null) {
  if (daysLeft === null) {
    return {
      text: "Needs date",
      bg: "#FCEBEB",
      color: "#A32D2D",
    };
  }

  if (daysLeft < 0) {
    return {
      text: `${Math.abs(daysLeft)} overdue`,
      bg: "#FCEBEB",
      color: "#A32D2D",
    };
  }

  if (daysLeft <= 30) {
    return {
      text: `${daysLeft} days`,
      bg: "#FAEEDA",
      color: "#854F0B",
    };
  }

  if (daysLeft <= 90) {
    return {
      text: `${daysLeft} days`,
      bg: "#E6F1FB",
      color: "#185FA5",
    };
  }

  return {
    text: `${daysLeft} days`,
    bg: "#EAF3DE",
    color: "#3B6D11",
  };
}

   

export default function DriverRenewalField({
  label,
  value,
  years = 0,
  days = 0,
  onChange,
  onMarkComplete,
}: Props) { 
  const isValidDateFormat = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const nextDue = isValidDateFormat ? addInterval(value, years, days) : "";
  const daysLeft = nextDue ? daysFrom(nextDue) : null;
  const badge = getBadge(daysLeft);
  const today = localDateString();
  const [confirming, setConfirming] = useState(false);
  const [completionDate, setCompletionDate] = useState(today);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: "#706E68", marginBottom: 4 }}>
        {label}
      </Text>

      <View
  style={{
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    maxWidth: 320,
  }}
>
        <TextInput
          placeholder="YYYY-MM-DD"
          value={value}
          onChangeText={(text) => onChange(formatDateInput(text))}
          style={{
            width: 160,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#D3D1C7",
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        />

        <View
        style={{
            backgroundColor: badge.bg,
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 4,
        }}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: badge.color }}>
            {badge.text}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 11, color: "#8A8880", marginTop: 4 }}>
        Format: YYYY-MM-DD
        {nextDue ? ` · Next due: ${nextDue}` : ""}
      </Text>
      {nextDue && onMarkComplete ? (
  <TouchableOpacity
    onPress={() => {
  setCompletionDate(today);
  setConfirming(true);
    }}
    style={{
      alignSelf: "flex-start",
      marginTop: 8,
      backgroundColor: "#EAF3DE",
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: "#C0DD97",
    }}
  >
    <Text style={{ fontSize: 12, color: "#27500A", fontWeight: "600" }}>
      Mark complete
    </Text>
  </TouchableOpacity>
) : null}
{confirming ? (
  <View style={{ marginTop: 8 }}>
    <Text style={{ fontSize: 12, color: "#706E68", marginBottom: 4 }}>
      Completion date
    </Text>

    <TextInput
      placeholder="YYYY-MM-DD"
      value={completionDate}
      onChangeText={(text) => setCompletionDate(formatDateInput(text))}
      style={{
        width: 160,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#D3D1C7",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
      }}
    />

    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      <TouchableOpacity
        onPress={() => setConfirming(false)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#D3D1C7",
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontSize: 12, color: "#706E68" }}>Cancel</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          if (!completionDate || !onMarkComplete) return;
          const confirmedNextDue = addInterval(completionDate, years, days);
          if (!confirmedNextDue) return;
          onMarkComplete(completionDate);
          setConfirming(false);
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#C0DD97",
          backgroundColor: "#EAF3DE",
        }}
      >
        <Text style={{ fontSize: 11, color: "#27500A", fontWeight: "600" }}>
          Confirm
        </Text>
      </TouchableOpacity>
    </View>
  </View>
) : null}
    </View>
    
  );
  
}