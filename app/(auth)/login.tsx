import { useState } from "react";
import {
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { router } from "expo-router";

export default function Login() {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const signIn = async () => {
    try {
      setMessage("Signing in...");
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  const createAccount = async () => {
    try {
      setMessage("Creating account...");
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setMessage(e.message);
    }
  };

        const submit = () => {
        if (Platform.OS !== "web") {
          signIn();
          return;
        }

        if (mode === "login") {
          signIn();
        } else {
          createAccount();
        }
      };
    return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: "#FAFAF8",
        paddingHorizontal: 24,
        paddingVertical: 42,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: "100%", maxWidth: 390 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 1.2,
            color: "#27500A",
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          WE <Text style={{ color: "#C0392B" }}>♥</Text> PAPERWORK
        </Text>

        <Text
          style={{
            fontSize: 38,
            fontWeight: "800",
            color: "#1A1915",
            textAlign: "center",
            lineHeight: 43,
            marginBottom: 12,
          }}
        >
          Helping keep trucks working.
        </Text>

        <Text
          style={{
            fontSize: 16,
            color: "#706E68",
            textAlign: "center",
            lineHeight: 24,
            marginBottom: 34,
          }}
        >
          Paperwork and DOT compliance organized in one quiet place.
        </Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#D3D1C7",
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 14,
            marginBottom: 10,
            fontSize: 15,
          }}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#D3D1C7",
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 14,
            marginBottom: 16,
            fontSize: 15,
            color: "#25241F"
          }}
        />

        <TouchableOpacity
          onPress={submit}
          style={{
            backgroundColor: "#27500A",
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                  {Platform.OS === "web"
                    ? mode === "login"
                      ? "Log In"
                      : "Create Account"
                    : "Log In"}
                </Text>
        </TouchableOpacity>

        {Platform.OS === "web" && (
        <TouchableOpacity
          onPress={() => setMode(mode === "login" ? "create" : "login")}
        >
          <Text
            style={{
              fontSize: 14,
              color: "#706E68",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
             {mode === "login"
          ? "Create a new account instead"
          : "Log in to an existing account instead"}
          </Text>
        </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() =>
            router.push("/compliance-guide")
          }
        >
          <Text
            style={{
              fontSize: 13,
              color: "#185FA5",
              textAlign: "center",
              fontWeight: "600",
            }}
          >
            Explore the free Compliance Guide ›
          </Text>
        </TouchableOpacity>

        {message ? (
          <Text
            style={{
              fontSize: 12,
              color: "#8A8880",
              textAlign: "center",
              marginTop: 16,
            }}
          >
            {message}
          </Text>
        ) : null}

        <Text
          style={{
            fontSize: 11,
            color: "#8A8880",
            textAlign: "center",
            marginTop: 26,
          }}
        >
          v0.1.0 Beta
        </Text>
      </View>
    </ScrollView>
  );
}