import { Text, View, TouchableOpacity } from "react-native";

type Props = {
  onSubscribe: () => void;
  onContactManaged?: () => void;
};

export default function PaywallCard({ onSubscribe, onContactManaged }: Props) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FAFAF8",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: "#E8E6E0",
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: "#27500A",
            letterSpacing: 1,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          WE HEART PAPERWORK
        </Text>

        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: "#1A1915",
            textAlign: "center",
            lineHeight: 34,
            marginBottom: 10,
          }}
        >
          You hate paperwork. We don’t.
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: "#706E68",
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 20,
          }}
        >
          We monitor DOT/FMCSA deadlines, driver renewals, and paperwork that can keep trucks off the road.
        </Text>

        <View
          style={{
            backgroundColor: "#F7F6F3",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#1A1915",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            Founding Fleet
          </Text>

          <Text
            style={{
              fontSize: 34,
              fontWeight: "800",
              color: "#1A1915",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            Early Access
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: "#8A8880",
              textAlign: "center",
            }}
          >
            Founding member pricing coming soon
          </Text>
        </View>

        <View style={{ gap: 8, marginBottom: 22 }}>
          {[
            "Company compliance tracking",
            "Driver renewal tracking",
            "DOT/FMCSA deadline dashboard",
            "Mobile-friendly access",
            "Regulation-change monitoring",
            "Simple enough for small fleets",
          ].map((item) => (
            <Text
              key={item}
              style={{
                fontSize: 14,
                color: "#1A1915",
                lineHeight: 20,
              }}
            >
              ✓ {item}
            </Text>
          ))}
        </View>

        <TouchableOpacity
          onPress={onSubscribe}
          style={{
            backgroundColor: "#27500A",
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            Join the Founding Fleet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onContactManaged}>
          <Text
            style={{
              fontSize: 13,
              color: "#185FA5",
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            Want us to manage compliance for you?
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 11,
            color: "#8A8880",
            textAlign: "center",
            lineHeight: 16,
            marginTop: 16,
          }}
        >
          You have enough to worry about. We help remove paperwork and compliance from the list.
        </Text>
      </View>
    </View>
  );
}