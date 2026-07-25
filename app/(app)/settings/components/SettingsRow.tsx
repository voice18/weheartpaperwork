import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type SettingsRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  showDivider?: boolean;
  valueColor?: string;
};

export default function SettingsRow({
  label,
  value,
  onPress,
  showDivider = true,
  valueColor = "#706E68",
}: SettingsRowProps) {
  const content = (
    <View
      style={[
        styles.row,
        showDivider && styles.divider,
      ]}
    >
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>

        {value ? (
          <Text
            style={[
              styles.value,
              { color: valueColor },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>

      {onPress ? (
        <Text style={styles.chevron}>›</Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E3DA",
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#25241F",
  },
  value: {
    marginTop: 3,
    fontSize: 13,
  },
  chevron: {
    marginLeft: 12,
    fontSize: 27,
    lineHeight: 27,
    color: "#9A9890",
  },
  pressed: {
    opacity: 0.65,
  },
});