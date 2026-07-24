Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$names = @("Submit", "Accept all", "Accept", "Yes, allow this time", "Proceed", "Skip", "Yes", "Allow")
foreach ($name in $names) {
    $cond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, $name
    )
    $els = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
    foreach ($el in $els) {
        $ct = $el.Current.ControlType.ProgrammaticName
        $cn = $el.Current.ClassName
        $rect = $el.Current.BoundingRectangle
        Write-Host "NAME='$name' TYPE=$ct CLASS='$cn' RECT=$($rect.X),$($rect.Y),$($rect.Width),$($rect.Height)"
    }
}
Write-Host "SCAN_DONE"
