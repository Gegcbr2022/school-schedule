import ActivityKit
import SwiftUI
import WidgetKit

/// Урок на екрані блокування й у динамічному острові.
///
/// Відлік тут не «12 хв», а `Text(timerInterval:)`: система рахує його
/// сама, без жодного оновлення від застосунку. Тому активність лишається
/// правдивою навіть тоді, коли «Дзвінку» сьогодні більше не відкривали.
///
/// Тривога — не окрема активність, а інший вигляд тієї самої: двох
/// активностей на екрані блокування було б забагато, та й головне під час
/// тривоги все одно одне — вона.
private struct LiveRoot: View {
  let state: DzvinkaActivity.ContentState

  private var profileName: String {
    state.profileName.isEmpty ? "Дзвінка" : state.profileName
  }

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        HStack(spacing: 6) {
          if state.underAlert {
            Image(systemName: "exclamationmark.triangle.fill")
              .foregroundStyle(alertTint(state.alert))
          }
          Text(headline)
            .font(.caption.weight(.semibold))
            .foregroundStyle(state.underAlert ? alertTint(state.alert) : .secondary)
            .lineLimit(1)
        }
        Text(subject)
          .font(.headline)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        Text(note)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)

        // Найчастіше на активність дивляться не щоб дізнатись, що зараз,
        // — це й так відомо, — а щоб зрозуміти, куди йти після дзвінка.
        // Під тривогою цей рядок ні до чого: там питання інше.
        if !state.underAlert, !state.next.isEmpty {
          Text(state.next)
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }
      }

      Spacer(minLength: 0)

      VStack(alignment: .trailing, spacing: 3) {
        if let deadline = state.deadline, deadline > .now {
          Text(timerInterval: Date.now...deadline, countsDown: true, showsHours: false)
            .font(.title2.monospacedDigit().weight(.semibold))
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: 92)
        }
        Text(profileName)
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .activityBackgroundTint(state.underAlert ? alertTint(state.alert).opacity(0.18) : nil)
  }

  private var headline: String {
    state.underAlert ? AlertLevel.title(state.alert) : state.headline
  }

  private var subject: String {
    state.underAlert ? (state.alertNote.isEmpty ? "Тривога" : state.alertNote) : state.subject
  }

  /// Під тривогою нижній рядок каже, що буде після відбою, — це єдине,
  /// чого в цей момент не видно більше ніде.
  private var note: String {
    if state.underAlert {
      return state.subject.isEmpty ? "Уроки призупинені" : "Після відбою: \(state.subject)"
    }
    return state.room.isEmpty ? "за київським часом" : state.room
  }
}

private func alertTint(_ level: Int) -> Color {
  level >= AlertLevel.red ? .red : .orange
}

struct DzvinkaLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: DzvinkaActivity.self) { context in
      LiveRoot(state: context.state)
    } dynamicIsland: { context in
      let state = context.state

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(state.underAlert ? AlertLevel.title(state.alert) : state.headline)
              .font(.caption2)
              .foregroundStyle(state.underAlert ? alertTint(state.alert) : .secondary)
              .lineLimit(1)
            Text(state.underAlert && !state.alertNote.isEmpty ? state.alertNote : state.subject)
              .font(.headline)
              .lineLimit(1)
              .minimumScaleFactor(0.8)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let deadline = state.deadline, deadline > .now {
            Text(timerInterval: Date.now...deadline, countsDown: true, showsHours: false)
              .font(.title3.monospacedDigit().weight(.semibold))
              .multilineTextAlignment(.trailing)
              .frame(maxWidth: 80)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(bottomLine(state))
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      } compactLeading: {
        Image(systemName: state.underAlert ? "exclamationmark.triangle.fill" : "bell.fill")
          .foregroundStyle(state.underAlert ? alertTint(state.alert) : .primary)
      } compactTrailing: {
        if let deadline = state.deadline, deadline > .now {
          Text(timerInterval: Date.now...deadline, countsDown: true, showsHours: false)
            .monospacedDigit()
            .frame(maxWidth: 44)
        }
      } minimal: {
        Image(systemName: state.underAlert ? "exclamationmark.triangle.fill" : "bell.fill")
          .foregroundStyle(state.underAlert ? alertTint(state.alert) : .primary)
      }
      .keylineTint(state.underAlert ? alertTint(state.alert) : nil)
    }
  }
}

private func bottomLine(_ state: DzvinkaActivity.ContentState) -> String {
  let profile = state.profileName.isEmpty ? "Дзвінка" : state.profileName
  if state.underAlert {
    return state.subject.isEmpty ? profile : "\(profile) · після відбою: \(state.subject)"
  }
  if !state.next.isEmpty { return state.next }
  return state.room.isEmpty ? profile : "\(profile) · \(state.room)"
}
