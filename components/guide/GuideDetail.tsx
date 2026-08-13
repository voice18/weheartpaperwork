import {
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type {
  ComplianceGuideEntry,
} from "../../lib/complianceGuide";

type Props = {
  entry: ComplianceGuideEntry;
  onBack: () => void;
};

type SectionProps = {
  title: string;
  text: string;
};

function GuideSection({
  title,
  text,
}: SectionProps) {
  return (
    <View
      style={{
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#ECEAE4",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "800",
          color: "#706E68",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 6,
          fontSize: 14,
          lineHeight: 21,
          color: "#383733",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export default function GuideDetail({
  entry,
  onBack,
}: Props) {
  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#F7F6F3",
      }}
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 48,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.75}
        style={{
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingRight: 12,
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: "#27500A",
          }}
        >
          ‹ Compliance Guide
        </Text>
      </TouchableOpacity>

      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "#E2E0D8",
          padding: 18,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 15,
            backgroundColor: "#EAF3DE",
            borderWidth: 1,
            borderColor: "#C0DD97",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              maxWidth: 40,
              fontSize: 14,
              fontWeight: "800",
              color: "#27500A",
            }}
          >
            {entry.iconText}
          </Text>
        </View>

        <Text
          style={{
            marginTop: 14,
            fontSize: 24,
            lineHeight: 30,
            fontWeight: "800",
            color: "#1A1915",
          }}
        >
          {entry.title}
        </Text>

        <Text
          style={{
            marginTop: 8,
            fontSize: 15,
            lineHeight: 22,
            color: "#706E68",
          }}
        >
          {entry.summary}
        </Text>

        <View style={{ marginTop: 10 }}>
          <GuideSection
            title="What this is"
            text={entry.whatItIs}
          />

          <GuideSection
            title="What you enter"
            text={entry.whatYouEnter}
          />

          <GuideSection
            title="How We Heart Paperwork calculates it"
            text={entry.howItWorks}
          />

          <GuideSection
            title="What Mark Complete does"
            text={entry.markComplete}
          />

          <GuideSection
            title="Notifications"
            text={entry.notifications}
          />

          <GuideSection
            title="Compliance history"
            text={entry.history}
          />

          <GuideSection
            title="Helpful to know"
            text={entry.helpfulToKnow}
          />
        </View>

        {entry.sources.length > 0 && (
          <View
            style={{
              paddingTop: 16,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: "#706E68",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              Official sources
            </Text>

            {entry.sources.map((source) => (
              <TouchableOpacity
                key={source.url}
                onPress={() =>
                  Linking.openURL(source.url)
                }
                activeOpacity={0.75}
                style={{
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 18,
                    fontWeight: "700",
                    color: "#185FA5",
                  }}
                >
                  {source.label} ›
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}