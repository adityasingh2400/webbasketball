# Wii Sports Basketball: Decompilation, Reverse Engineering & Open-Source Resources

## CRITICAL FINDING: Wii Sports Does NOT Have Basketball

**Wii Sports (2006)** only includes 5 sports:
- Baseball
- Tennis  
- Golf
- Boxing
- Bowling

**Basketball is exclusive to Wii Sports Resort (2009)**, which has NOT been decompiled yet.

---

## Available Resources

### 1. ACTIVE DECOMPILATION PROJECT: Wii Sports (Original)

**Repository**: [doldecomp/ogws](https://github.com/doldecomp/ogws)
- **Status**: 29.12% decompiled (as of March 2026)
- **Language**: C (76.7%), C++ (22.2%)
- **License**: CC0-1.0 (clean-room decompilation)
- **Last Updated**: Feb 28, 2026

**Key Files for Physics/Motion**:
- Scene structure: [RPSysSceneCreator.h](https://github.com/doldecomp/ogws/blob/master/include/Pack/RPSystem/RPSysSceneCreator.h)
- Sports data: [RPSportsPlayerData.h](https://github.com/doldecomp/ogws/blob/master/include/Pack/RPSystem/RPSportsPlayerData.h)
- Audio (includes Bsb/Baseball): [rp_Bsb_sound.h](https://github.com/doldecomp/ogws/blob/master/include/Pack/RPAudio/archive/rp_Bsb_sound.h)

**Decompilation Progress**: https://decomp.dev/doldecomp/ogws

---

### 2. DOCUMENTED WII SPORTS STRUCTURES: ogws_info

**Repository**: [kiwi515/ogws_info](https://github.com/kiwi515/ogws_info)
- **Purpose**: Documented data structures from Wii Sports decompilation
- **Language**: C++ (75.2%), C (24.8%)
- **Key Content**:
  - RP engine documentation (game engine used in Wii Sports)
  - Symbol maps for Dolphin emulator debugging
  - CSV symbol database for analysis

**Documented Sports Scenes**:
- RPBowScene (Bowling)
- RPBoxScene (Boxing)
- RPGolScene (Golf)
- RPTnsScene (Tennis)
- RPBsbScene (Baseball)

---

### 3. OPEN-SOURCE WII SPORTS RECREATION: Rii-sports

**Repository**: [Badgerworks-Brewery/Rii-sports](https://github.com/Badgerworks-Brewery/Rii-sports)
- **Status**: Active development (last push Nov 16, 2025)
- **Engine**: Unity (2022.3 LTS+)
- **Language**: C# (82.4%)
- **Scope**: Recreating Wii Sports & Wii Fit for modern platforms

**Key Features**:
- ✅ Motion control implementation (DSU protocol)
- ✅ Gamepad support with haptic feedback
- ✅ Bowling physics with motion-based throwing
- ✅ Framework for Tennis, Golf, Boxing, Baseball
- ⚠️ Basketball NOT yet implemented

---

## MOTION CONTROL IMPLEMENTATION (Rii-sports)

### Motion Data Structure

**File**: [DSUMotionData.cs](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Input/DSUMotionData.cs)

```csharp
public struct DSUMotionData
{
    public Vector3 accelerometer;  // 3-axis acceleration
    public Vector3 gyroscope;      // 3-axis rotation
    public Vector3 orientation;    // Euler angles
    public bool isConnected;
    public float timestamp;
}

public enum MotionGesture
{
    None,
    SwingForward,
    SwingBackward,
    SwingLeft,
    SwingRight,
    Shake,
    Tilt
}
```

**Evidence**: [DSUMotionData.cs#L10-L42](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Input/DSUMotionData.cs#L10-L42)

---

### Gesture Detection Algorithm

**File**: [MotionGestureDetector.cs](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Input/MotionGestureDetector.cs)

**Key Algorithm: Swing Detection**

```csharp
private void DetectSwingGesture(DSUMotionData currentData)
{
    Vector3 currentAccel = currentData.accelerometer;
    Vector3 currentGyro = currentData.gyroscope;
    
    // Calculate acceleration magnitude
    float accelMagnitude = currentAccel.magnitude;
    
    // Detect swing start (sudden acceleration)
    if (!isInSwingMotion && accelMagnitude > swingThreshold)
    {
        isInSwingMotion = true;
        swingStartAccel = currentAccel;
        swingStartTime = Time.time;
    }
    
    // Detect swing completion (deceleration after acceleration)
    if (isInSwingMotion && Time.time - swingStartTime > 0.1f)
    {
        if (accelMagnitude < swingThreshold * 0.5f || Time.time - swingStartTime > 1.0f)
        {
            // Swing completed
            Vector3 swingDirection = (currentAccel - swingStartAccel).normalized;
            float swingIntensity = Mathf.Clamp01(
                (swingStartAccel.magnitude - swingThreshold) / swingThreshold
            );
            
            MotionGesture gestureType = DetermineSwingDirection(swingDirection);
            OnGestureDetected?.Invoke(new MotionGestureEvent(
                gestureType,
                swingIntensity,
                swingDirection,
                Time.time
            ));
        }
    }
}
```

**Evidence**: [MotionGestureDetector.cs#L63-L111](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Input/MotionGestureDetector.cs#L63-L111)

**Configurable Thresholds**:
- `swingThreshold = 2.0f` (m/s²)
- `shakeThreshold = 3.0f` (m/s²)
- `gestureTimeout = 0.5f` (seconds)
- `motionHistorySize = 10` (samples)

---

### Bowling-Specific Motion Detection

```csharp
private void DetectBowlingSwing(DSUMotionData currentData)
{
    Vector3 currentAccel = currentData.accelerometer;
    
    // Bowling swing detection: forward motion with controlled angle
    float forwardVelocity = Vector3.Dot(currentAccel, Vector3.forward);
    float sidewaysVelocity = Vector3.Dot(currentAccel, Vector3.right);
    
    // Check if motion is primarily forward
    if (forwardVelocity > bowlingSwingMinVelocity)
    {
        float swingAngle = Mathf.Atan2(sidewaysVelocity, forwardVelocity) * Mathf.Rad2Deg;
        
        if (Mathf.Abs(swingAngle) <= bowlingSwingMaxAngle)
        {
            // Valid bowling swing detected
            Vector3 throwDirection = new Vector3(sidewaysVelocity, 0, forwardVelocity).normalized;
            float throwForce = Mathf.Clamp(forwardVelocity / bowlingSwingMinVelocity, 0.5f, 3.0f);
            
            OnBowlingSwingDetected?.Invoke(throwDirection, throwForce);
        }
    }
}
```

**Evidence**: [MotionGestureDetector.cs#L148-L177](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Input/MotionGestureDetector.cs#L148-L177)

**Parameters**:
- `bowlingSwingMinVelocity = 1.5f` (m/s)
- `bowlingSwingMaxAngle = 45f` (degrees)

---

## PHYSICS IMPLEMENTATION: Ball Throwing

**File**: [BowlingBall.cs](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Sports/bowling/BowlingBall.cs)

### Motion-Based Throwing

```csharp
private void ThrowBallWithMotion()
{
    // Calculate throw force based on motion data
    float calculatedForce = Mathf.Clamp(
        motionThrowForce * motionForceMultiplier * motionSensitivity,
        minThrowForce,
        maxThrowForce
    );
    
    // Apply force response curve for more natural feel
    float normalizedForce = (calculatedForce - minThrowForce) / (maxThrowForce - minThrowForce);
    float curvedForce = forceResponseCurve.Evaluate(normalizedForce);
    calculatedForce = Mathf.Lerp(minThrowForce, maxThrowForce, curvedForce);
    
    // Calculate throw direction
    Vector3 throwDirection = CalculateThrowDirection();
    
    // Apply force to ball
    rb.AddForce(throwDirection * calculatedForce);
    
    // Add some spin based on motion direction
    Vector3 spin = Vector3.Cross(throwDirection, Vector3.up) * motionThrowForce * 0.5f;
    rb.AddTorque(spin);
}
```

**Evidence**: [BowlingBall.cs#L86-L114](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Sports/bowling/BowlingBall.cs#L86-L114)

### Direction Calculation

```csharp
private Vector3 CalculateThrowDirection()
{
    // Base direction is forward
    Vector3 baseDirection = transform.forward;
    
    // Apply motion direction influence
    Vector3 motionInfluence = new Vector3(
        motionThrowDirection.x * motionSensitivity,
        0f, // Keep Y at 0 for bowling
        motionThrowDirection.z
    );
    
    // Combine base direction with motion influence
    Vector3 finalDirection = (baseDirection + motionInfluence).normalized;
    
    // Ensure the ball doesn't go backwards or too far sideways
    finalDirection.z = Mathf.Max(finalDirection.z, 0.5f);
    finalDirection.x = Mathf.Clamp(finalDirection.x, -0.5f, 0.5f);
    
    return finalDirection.normalized;
}
```

**Evidence**: [BowlingBall.cs#L122-L142](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Sports/bowling/BowlingBall.cs#L122-L142)

### Force Parameters

```csharp
[Header("Ball Settings")]
public float throwForce = 500f;                    // Default throw force
public float motionForceMultiplier = 200f;        // Motion → force conversion
public float maxThrowForce = 1500f;               // Maximum force cap
public float minThrowForce = 100f;                // Minimum force floor

[Header("Motion Control")]
[SerializeField] private float motionSensitivity = 1.0f;
[SerializeField] private AnimationCurve forceResponseCurve;  // Non-linear response
```

**Evidence**: [BowlingBall.cs#L8-L18](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Sports/bowling/BowlingBall.cs#L8-L18)

---

## DSU PROTOCOL (Motion Control Communication)

**File**: [DSUClient.cs](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Input/DSUClient.cs)

### Protocol Constants

```csharp
private const string DSU_MAGIC = "DSUC";
private const ushort DSU_VERSION = 1001;
private const uint DSU_CLIENT_ID = 0x12345678;

// Packet types
private const uint DSUC_VERSIONREQ = 0x100000;
private const uint DSUS_VERSION = 0x100000;
private const uint DSUC_LISTPORTS = 0x100001;
private const uint DSUS_PORTINFO = 0x100001;
private const uint DSUC_PADDATAREQ = 0x100002;
private const uint DSUS_PADDATARSP = 0x100002;
```

**Evidence**: [DSUClient.cs#L37-L47](https://github.com/Badgerworks-Brewery/Rii-sports/blob/84a545718709635954294828451962e8a8521270/Assets/Scripts/Input/DSUClient.cs#L37-L47)

### Connection Details

- **Protocol**: UDP
- **Default Port**: 26760
- **Server IP**: 127.0.0.1 (localhost)
- **Connection Timeout**: 5 seconds
- **Supported Devices**: Smartphones (via DSU app), DualShock 4, DualSense, Switch Pro Controller

---

## WIIREMOTE HARDWARE DOCUMENTATION

### Wii Remote Sensors

**Source**: [WiiBrew - Wiimote Technical Guide](https://wiibrew.org/w/index.php?title=Wiimote)

**Accelerometer**:
- **IC**: ADXL330 (Analog Devices)
- **Range**: ±3g minimum
- **Axes**: 3-axis linear acceleration
- **Sensitivity**: 10% rated
- **Location**: Top surface of circuit board, left of A button

**IR Camera**:
- **Resolution**: 1024×768 pixels
- **Frame Rate**: High (100+ Hz)
- **Tracking**: Up to 4 IR points
- **Purpose**: Sensor bar position detection for cursor control

**Gyroscope** (Wii MotionPlus):
- **Type**: 3-axis angular velocity sensor
- **Attachment**: Base of Wii Remote
- **Provides**: Rotational data (yaw, pitch, roll)

**Evidence**: [WiiBrew Wiimote Documentation](https://wiibrew.org/w/index.php?title=Wiimote)

---

## WIIREMOTE MOTION TRACKING RESEARCH

### Academic Paper: Self-Calibrating Optical Object Tracking

**Title**: "Self-calibrating optical object tracking using Wii remotes"
**Authors**: Ian F. Rickard, James E. Davis (UC Santa Cruz)
**Published**: 2009

**Key Findings**:
- Wii Remote IR camera tracks 4 points at 1024×768 resolution
- Accelerometer provides pitch/roll (inclination) estimation
- Perspective n-Point (PnP) algorithm for 6DOF tracking
- Accuracy: Better than 1/4 pixel with proper calibration
- Rotation sensitivity: 10° handheld rotation ≈ same displacement as 50-100cm sensor distance

**Evidence**: [PDF - Self-calibrating optical object tracking using Wii remotes](http://alumni.soe.ucsc.edu/~inio/wiipaper.pdf)

---

### Academic Paper: Wii Remote in Physics Education

**Title**: "Using low cost game controllers to capture data for 6th grade science labs"
**Authors**: Wendy Ju, Ugochi Acholonu, Sarah Lewis
**Published**: 2011

**Key Findings**:
- Wii Remote accelerometer captures 3-axis acceleration data
- Data can be smoothed and weighted for gesture recognition
- Useful for velocity and acceleration measurements
- Cost-effective motion capture alternative

**Evidence**: [PDF - Using low cost game controllers to capture data](https://wendyju.com/publications/p1115-lewis.pdf)

---

### Technical Guide: Wii Remote Programming

**Source**: Chapter 10 - "Wiimote" from NUI textbook
**Topics Covered**:
- Button detection (presses, releases, held)
- Motion sensing (orientation and acceleration on 3 axes)
- Accelerometer to gesture conversion
- IR tracking and 3D localization
- Nunchuk attachment integration
- Wiiuse library (C library for Wii Remote access)

**Evidence**: [PDF - Chapter 10: Wiimote](https://coe.psu.ac.th/ad/jg/nui15a/wiimote.pdf)

---

## WIIREMOTE MOTION CONTROL IMPLEMENTATION

### Wii Remote Head Tracking for 3D Audio

**Title**: "Wii Remote-based Head Tracking in 3D Audio Rendering"
**Key Technique**: Perspective n-Point (PnP) Problem
- Mount 4 IR LEDs on headset
- Wii Remote IR camera detects LED positions
- Solves for 6DOF (position + orientation)
- Resolution: 1024×768 pixels at ~100 Hz

**Evidence**: [Academia.edu - Wii Remote-based Head Tracking](https://www.academia.edu/29027830/Wii_Remote_based_Head_Tracking_in_3D_Audio_Rendering)

---

## RECOMMENDED APPROACH FOR BASKETBALL

### 1. **Use Rii-sports as Foundation**
   - Already has motion control framework
   - DSU protocol implementation ready
   - Physics system in place
   - Add basketball-specific logic

### 2. **Implement Basketball Mechanics**
   - **Shooting**: Upward swing gesture → ball trajectory
   - **Passing**: Directional swing → pass direction/force
   - **Dribbling**: Downward shake → ball bounce
   - **Defense**: Lateral swings → block attempts

### 3. **Motion-to-Physics Mapping**
   ```
   Gesture Type          → Game Action
   SwingForward/Up       → Shoot/Pass
   SwingBackward         → Dribble/Retreat
   SwingLeft/Right       → Lateral movement
   Shake                 → Defensive action
   Tilt                  → Aim adjustment
   ```

### 4. **Force Calculation**
   ```
   Force = (AccelerationMagnitude - Threshold) × Multiplier × SensitivityCurve
   Direction = NormalizedAcceleration + PlayerFacingDirection
   ```

---

## RESOURCES SUMMARY

| Resource | Type | Status | Link |
|----------|------|--------|------|
| Wii Sports Decompilation | Source Code | 29% Complete | https://github.com/doldecomp/ogws |
| Wii Sports Documentation | Structures | Complete | https://github.com/kiwi515/ogws_info |
| Rii-sports Recreation | Open Source | Active | https://github.com/Badgerworks-Brewery/Rii-sports |
| Wii Remote Hardware | Documentation | Complete | https://wiibrew.org/wiki/Wiimote |
| Motion Tracking Research | Academic | Published | http://alumni.soe.ucsc.edu/~inio/wiipaper.pdf |
| Physics Education | Academic | Published | https://wendyju.com/publications/p1115-lewis.pdf |

---

## NEXT STEPS

1. **Clone Rii-sports** and study the motion control implementation
2. **Implement basketball-specific gestures** in MotionGestureDetector
3. **Create BowlingBall equivalent** for basketball (BallController)
4. **Test with DSU-compatible device** (smartphone with DSU app or DS4 controller)
5. **Tune force/direction parameters** for authentic Wii Sports feel

---

**Last Updated**: March 25, 2026
**Research Scope**: Wii Sports Basketball mechanics, motion control, physics
**Status**: Wii Sports Resort basketball decompilation NOT available; Rii-sports provides best open-source foundation
