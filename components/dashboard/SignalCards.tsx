import {Pressable, View, Text } from "react-native";

type Props = {
  overdueCount: number;
  soonCount: number;
  upcomingCount: number;
  filter: "od" | "sn" | "up" | null;
  setFilter: (value: "od" | "sn" | "up" | null) => void;
};

type CardProps = {
  count: number;
  label: string;
  color: string;
  bg: string;
  active: boolean;
  onPress: () => void;
};

function Card({
  count,
  label,
  color,
  bg,
  active,
  onPress,
}: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 10,
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: active ? 1.5 : 0.5,
        borderColor: active ? color : "transparent",
        backgroundColor: bg,
        position: "relative",
      }}
    >
      

      <Text style={{ fontSize: 22, fontWeight: "600", color }}>{count}</Text>

      <Text style={{ fontSize: 10, fontWeight: "500", marginTop: 2, color }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SignalCards({
  overdueCount,
  soonCount,
  upcomingCount,
  filter,
  setFilter,
}: Props) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
      <Card
        count={overdueCount}
        label="Overdue"
        color="#A32D2D"
        bg="#FCEBEB"
        active={filter === "od"}
        onPress={() => setFilter(filter === "od" ? null : "od")}
      />

      <Card
        count={soonCount}
        label="30 days"
        color="#854F0B"
        bg="#FAEEDA"
        active={filter === "sn"}
        onPress={() => setFilter(filter === "sn" ? null : "sn")}
      />

      <Card
        count={upcomingCount}
        label="90 days"
        color="#185FA5"
        bg="#E6F1FB"
        active={filter === "up"}
        onPress={() => setFilter(filter === "up" ? null : "up")}
      />
    </View>
  );
}