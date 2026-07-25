import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function CheckoutPlaceholder() {
  const router = useRouter();

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
          I HATE PAPERWORK
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
          Small Carrier Plan
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
          $49/mo
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: "#706E68",
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 22,
          }}
        >
          Stripe Checkout will connect here. For now, this confirms the payment flow and page design.
        </Text>

        <TouchableOpacity
          onPress={() => alert("Stripe Checkout will open here.")}
          style={{
            backgroundColor: "#27500A",
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            Continue to Secure Checkout
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text
            style={{
              fontSize: 13,
              color: "#706E68",
              textAlign: "center",
              textDecorationLine: "underline",
            }}
          >
            Back
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}